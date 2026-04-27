"""GLASSWORK backend — FastAPI + MongoDB.

Construction site management for aluminum & glass companies.
JWT auth with bcrypt, role-based access (ADMIN, MANAGER, WORKER).
"""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
import uuid
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal, Any

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# ---------- Logging ----------
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("glasswork")

# ---------- Mongo ----------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# ---------- App / router ----------
app = FastAPI(title="GLASSWORK API")
api = APIRouter(prefix="/api")

JWT_ALGO = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]
ACCESS_MIN = 15
REFRESH_DAYS = 7

bearer_scheme = HTTPBearer(auto_error=False)


# =========================================================
# Helpers
# =========================================================
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: Optional[datetime]) -> Optional[str]:
    if not dt:
        return None
    if isinstance(dt, str):
        return dt
    return dt.replace(tzinfo=timezone.utc).isoformat() if dt.tzinfo is None else dt.isoformat()


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(payload: dict, expires_delta: timedelta) -> str:
    to_encode = payload.copy()
    to_encode["exp"] = now_utc() + expires_delta
    to_encode["iat"] = now_utc()
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGO)


def create_access_token(user_id: str, role: str, company_id: str) -> str:
    return create_token({"sub": user_id, "role": role, "cid": company_id, "type": "access"}, timedelta(minutes=ACCESS_MIN))


def create_refresh_token(user_id: str) -> str:
    return create_token({"sub": user_id, "type": "refresh"}, timedelta(days=REFRESH_DAYS))


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def serialize(doc: dict) -> dict:
    """Strip _id and convert datetimes to ISO."""
    if not doc:
        return doc
    doc.pop("_id", None)
    for k, v in list(doc.items()):
        if isinstance(v, datetime):
            doc[k] = iso(v)
    return doc


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    if credentials is None or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(credentials.credentials)
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_role(*roles: str):
    async def _dep(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return _dep


def strip_costs_for_worker(obj: dict, role: str) -> dict:
    if role != "WORKER":
        return obj
    out = dict(obj)
    for k in ("budget", "spent", "remaining", "total_cost", "unit_price", "projected_final_cost"):
        if k in out:
            out[k] = None
    return out


# =========================================================
# Models
# =========================================================
Role = Literal["ADMIN", "MANAGER", "WORKER"]
ProjectStatus = Literal["PENDING", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"]
MatCategory = Literal["PERFILERIA", "VIDRIO", "HERRAJES", "SELLANTES", "HERRAMIENTAS", "CONSUMIBLES", "OTROS"]
EntryType = Literal["PURCHASE", "USAGE", "RETURN", "ADJUSTMENT"]
PhotoType = Literal["PROGRESS", "BEFORE", "AFTER", "INCIDENT", "MATERIAL", "MEASUREMENT"]
Weather = Literal["SUNNY", "CLOUDY", "RAINY", "WINDY", "STOPPED_BY_WEATHER"]
LogStatus = Literal["PENDING", "APPROVED", "REJECTED"]
AlertType = Literal["LOW_STOCK", "BUDGET_EXCEEDED", "PROJECT_DELAYED", "INCIDENT_REPORTED", "LOG_MISSING"]
AlertSeverity = Literal["INFO", "WARNING", "CRITICAL"]


class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str
    company_name: str
    phone: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class RefreshIn(BaseModel):
    refresh_token: str


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    user: dict


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Role = "WORKER"
    phone: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[Role] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None


class ProjectIn(BaseModel):
    name: str
    description: Optional[str] = ""
    address: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    status: ProjectStatus = "PENDING"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    actual_end_date: Optional[str] = None
    budget: float = 0.0
    client_name: str = ""
    client_phone: str = ""
    client_email: str = ""
    notes: str = ""
    assigned_worker_ids: List[str] = []
    cover_photo: Optional[str] = None


class MaterialIn(BaseModel):
    name: str
    unit: Literal["m2", "m", "ud", "kg", "l", "caja"]
    category: MatCategory
    unit_price: float = 0.0
    supplier: str = ""
    notes: str = ""


class MaterialEntryIn(BaseModel):
    project_id: str
    material_id: str
    quantity: float
    unit_price: Optional[float] = None  # if None, use catalog price
    type: EntryType = "USAGE"
    date: Optional[str] = None
    notes: str = ""
    receipt_photo: Optional[str] = None  # base64


class DailyLogIn(BaseModel):
    project_id: str
    date: Optional[str] = None
    hours_worked: float
    work_description: str
    weather_condition: Weather = "SUNNY"
    progress_percentage: float = 0.0
    incidents: Optional[str] = None
    photo_ids: List[str] = []
    material_entry_ids: List[str] = []


class LogReviewIn(BaseModel):
    status: Literal["APPROVED", "REJECTED"]
    review_comment: Optional[str] = ""


class PhotoIn(BaseModel):
    project_id: str
    daily_log_id: Optional[str] = None
    image_base64: str  # full data URI or just base64
    caption: str = ""
    photo_type: PhotoType = "PROGRESS"


# =========================================================
# Auth endpoints
# =========================================================
@api.post("/auth/register", response_model=TokenOut)
async def register(body: RegisterIn):
    email = body.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email ya registrado")
    company_id = str(uuid.uuid4())
    company = {
        "id": company_id,
        "name": body.company_name,
        "logo": None,
        "address": "",
        "phone": "",
        "email": "",
        "created_at": now_utc(),
    }
    await db.companies.insert_one(company.copy())
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "name": body.name,
        "email": email,
        "password_hash": hash_password(body.password),
        "role": "ADMIN",
        "company_id": company_id,
        "phone": body.phone or "",
        "avatar": None,
        "is_active": True,
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    await db.users.insert_one(user.copy())
    access = create_access_token(user_id, "ADMIN", company_id)
    refresh = create_refresh_token(user_id)
    user_out = {k: v for k, v in user.items() if k != "password_hash"}
    return TokenOut(access_token=access, refresh_token=refresh, user=serialize(user_out))


@api.post("/auth/login", response_model=TokenOut)
async def login(body: LoginIn):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Cuenta desactivada")
    access = create_access_token(user["id"], user["role"], user["company_id"])
    refresh = create_refresh_token(user["id"])
    user_out = {k: v for k, v in user.items() if k not in ("_id", "password_hash")}
    return TokenOut(access_token=access, refresh_token=refresh, user=serialize(user_out))


@api.post("/auth/refresh")
async def refresh_token(body: RefreshIn):
    payload = decode_token(body.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    access = create_access_token(user["id"], user["role"], user["company_id"])
    return {"access_token": access}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return serialize(user)


@api.post("/auth/logout")
async def logout(user: dict = Depends(get_current_user)):
    return {"ok": True}


# =========================================================
# Users / team management
# =========================================================
@api.get("/users")
async def list_users(user: dict = Depends(get_current_user)):
    users = await db.users.find({"company_id": user["company_id"]}, {"_id": 0, "password_hash": 0}).to_list(500)
    # add stats: total hours this month, logs this month, projects assigned
    month_start = datetime(now_utc().year, now_utc().month, 1, tzinfo=timezone.utc)
    out = []
    for u in users:
        logs = await db.daily_logs.find({"worker_id": u["id"], "date": {"$gte": month_start}}).to_list(2000)
        u["hours_this_month"] = round(sum(l.get("hours_worked", 0) for l in logs), 1)
        u["logs_this_month"] = len(logs)
        proj_count = await db.projects.count_documents({"assigned_worker_ids": u["id"]})
        u["projects_count"] = proj_count
        out.append(serialize(u))
    return out


@api.post("/users")
async def create_user(body: UserCreate, user: dict = Depends(require_role("ADMIN"))):
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email ya registrado")
    nu = {
        "id": str(uuid.uuid4()),
        "name": body.name,
        "email": email,
        "password_hash": hash_password(body.password),
        "role": body.role,
        "company_id": user["company_id"],
        "phone": body.phone or "",
        "avatar": None,
        "is_active": True,
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    await db.users.insert_one(nu.copy())
    nu.pop("password_hash", None)
    return serialize(nu)


@api.patch("/users/{user_id}")
async def update_user(user_id: str, body: UserUpdate, user: dict = Depends(require_role("ADMIN"))):
    upd = {k: v for k, v in body.dict().items() if v is not None}
    upd["updated_at"] = now_utc()
    await db.users.update_one({"id": user_id, "company_id": user["company_id"]}, {"$set": upd})
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return serialize(u)


# =========================================================
# Projects
# =========================================================
async def project_metrics(project_id: str) -> dict:
    """Compute spent, photo count, log count."""
    pipeline = [{"$match": {"project_id": project_id}}, {"$group": {"_id": None, "spent": {"$sum": "$total_cost"}}}]
    res = await db.material_entries.aggregate(pipeline).to_list(1)
    spent = res[0]["spent"] if res else 0.0
    photo_count = await db.project_photos.count_documents({"project_id": project_id})
    log_count = await db.daily_logs.count_documents({"project_id": project_id})
    return {"spent": round(spent, 2), "photo_count": photo_count, "log_count": log_count}


def filter_project_for_role(p: dict, role: str) -> dict:
    p = serialize(p)
    if role == "WORKER":
        for k in ("budget", "spent", "remaining"):
            if k in p:
                p[k] = None
    return p


@api.get("/projects")
async def list_projects(
    status_f: Optional[str] = Query(None, alias="status"),
    user: dict = Depends(get_current_user),
):
    q: dict = {"company_id": user["company_id"]}
    if status_f:
        q["status"] = status_f
    if user["role"] == "WORKER":
        q["assigned_worker_ids"] = user["id"]
    projects = await db.projects.find(q).sort("created_at", -1).to_list(500)
    out = []
    for p in projects:
        m = await project_metrics(p["id"])
        p["spent"] = m["spent"]
        p["remaining"] = round((p.get("budget", 0) - m["spent"]), 2)
        p["photo_count"] = m["photo_count"]
        p["log_count"] = m["log_count"]
        out.append(filter_project_for_role(p, user["role"]))
    return out


@api.get("/projects/{project_id}")
async def get_project(project_id: str, user: dict = Depends(get_current_user)):
    p = await db.projects.find_one({"id": project_id, "company_id": user["company_id"]})
    if not p:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    if user["role"] == "WORKER" and user["id"] not in p.get("assigned_worker_ids", []):
        raise HTTPException(status_code=403, detail="Sin acceso a este proyecto")
    m = await project_metrics(project_id)
    p["spent"] = m["spent"]
    p["remaining"] = round((p.get("budget", 0) - m["spent"]), 2)
    p["photo_count"] = m["photo_count"]
    p["log_count"] = m["log_count"]
    # assigned workers info
    workers = await db.users.find(
        {"id": {"$in": p.get("assigned_worker_ids", [])}}, {"_id": 0, "password_hash": 0}
    ).to_list(50)
    p["assigned_workers"] = [serialize(w) for w in workers]
    return filter_project_for_role(p, user["role"])


@api.post("/projects")
async def create_project(body: ProjectIn, user: dict = Depends(require_role("ADMIN", "MANAGER"))):
    pid = str(uuid.uuid4())
    proj = {
        "id": pid,
        "company_id": user["company_id"],
        "manager_id": user["id"],
        "created_at": now_utc(),
        "updated_at": now_utc(),
        **body.dict(),
    }
    await db.projects.insert_one(proj.copy())
    return serialize(proj)


@api.patch("/projects/{project_id}")
async def update_project(
    project_id: str, body: ProjectIn, user: dict = Depends(require_role("ADMIN", "MANAGER"))
):
    upd = body.dict()
    upd["updated_at"] = now_utc()
    await db.projects.update_one(
        {"id": project_id, "company_id": user["company_id"]}, {"$set": upd}
    )
    p = await db.projects.find_one({"id": project_id})
    return serialize(p)


@api.delete("/projects/{project_id}")
async def delete_project(project_id: str, user: dict = Depends(require_role("ADMIN", "MANAGER"))):
    await db.projects.delete_one({"id": project_id, "company_id": user["company_id"]})
    return {"ok": True}


# =========================================================
# Materials catalog
# =========================================================
@api.get("/materials")
async def list_materials(
    category: Optional[str] = None,
    q: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    flt: dict = {"company_id": user["company_id"]}
    if category:
        flt["category"] = category
    if q:
        flt["name"] = {"$regex": q, "$options": "i"}
    mats = await db.materials.find(flt).sort("name", 1).to_list(2000)
    out = []
    for m in mats:
        m = serialize(m)
        if user["role"] == "WORKER":
            m["unit_price"] = None
        out.append(m)
    return out


@api.post("/materials")
async def create_material(body: MaterialIn, user: dict = Depends(require_role("ADMIN", "MANAGER"))):
    m = {
        "id": str(uuid.uuid4()),
        "company_id": user["company_id"],
        "is_archived": False,
        "created_at": now_utc(),
        **body.dict(),
    }
    await db.materials.insert_one(m.copy())
    return serialize(m)


@api.patch("/materials/{mid}")
async def update_material(mid: str, body: MaterialIn, user: dict = Depends(require_role("ADMIN", "MANAGER"))):
    upd = body.dict()
    await db.materials.update_one({"id": mid, "company_id": user["company_id"]}, {"$set": upd})
    m = await db.materials.find_one({"id": mid})
    return serialize(m)


# =========================================================
# Material entries
# =========================================================
@api.get("/material-entries")
async def list_material_entries(
    project_id: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    flt: dict = {"company_id": user["company_id"]}
    if project_id:
        flt["project_id"] = project_id
    if user["role"] == "WORKER":
        flt["worker_id"] = user["id"]
    entries = await db.material_entries.find(flt).sort("date", -1).to_list(1000)
    # enrich with material info
    out = []
    for e in entries:
        e = serialize(e)
        mat = await db.materials.find_one({"id": e["material_id"]}, {"_id": 0})
        e["material"] = serialize(mat) if mat else None
        if user["role"] == "WORKER":
            e["unit_price"] = None
            e["total_cost"] = None
        out.append(e)
    return out


@api.post("/material-entries")
async def create_material_entry(body: MaterialEntryIn, user: dict = Depends(get_current_user)):
    mat = await db.materials.find_one({"id": body.material_id, "company_id": user["company_id"]})
    if not mat:
        raise HTTPException(status_code=404, detail="Material no encontrado")
    proj = await db.projects.find_one({"id": body.project_id, "company_id": user["company_id"]})
    if not proj:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    if user["role"] == "WORKER" and user["id"] not in proj.get("assigned_worker_ids", []):
        raise HTTPException(status_code=403, detail="Sin acceso al proyecto")
    unit_price = body.unit_price if body.unit_price is not None else mat.get("unit_price", 0)
    if user["role"] == "WORKER":
        # workers cannot define prices
        unit_price = mat.get("unit_price", 0)
    total = round(unit_price * body.quantity, 2)
    entry_date = body.date or now_utc().isoformat()
    entry = {
        "id": str(uuid.uuid4()),
        "company_id": user["company_id"],
        "project_id": body.project_id,
        "material_id": body.material_id,
        "quantity": body.quantity,
        "unit_price": unit_price,
        "total_cost": total,
        "type": body.type,
        "worker_id": user["id"],
        "date": entry_date,
        "notes": body.notes,
        "receipt_photo": body.receipt_photo,
        "created_at": now_utc(),
    }
    await db.material_entries.insert_one(entry.copy())
    out = serialize(entry)
    if user["role"] == "WORKER":
        out["unit_price"] = None
        out["total_cost"] = None
    return out


# =========================================================
# Daily logs
# =========================================================
@api.get("/daily-logs")
async def list_logs(
    project_id: Optional[str] = None,
    worker_id: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    flt: dict = {"company_id": user["company_id"]}
    if project_id:
        flt["project_id"] = project_id
    if worker_id:
        flt["worker_id"] = worker_id
    if user["role"] == "WORKER":
        flt["worker_id"] = user["id"]
    logs = await db.daily_logs.find(flt).sort("date", -1).to_list(1000)
    out = []
    for log in logs:
        log = serialize(log)
        worker = await db.users.find_one({"id": log["worker_id"]}, {"_id": 0, "password_hash": 0})
        log["worker"] = serialize(worker) if worker else None
        proj = await db.projects.find_one({"id": log["project_id"]}, {"_id": 0})
        log["project_name"] = (proj or {}).get("name")
        out.append(log)
    return out


@api.get("/daily-logs/{log_id}")
async def get_log(log_id: str, user: dict = Depends(get_current_user)):
    log = await db.daily_logs.find_one({"id": log_id, "company_id": user["company_id"]})
    if not log:
        raise HTTPException(status_code=404, detail="Parte no encontrado")
    if user["role"] == "WORKER" and log["worker_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Sin acceso")
    log = serialize(log)
    worker = await db.users.find_one({"id": log["worker_id"]}, {"_id": 0, "password_hash": 0})
    log["worker"] = serialize(worker) if worker else None
    photos = await db.project_photos.find({"id": {"$in": log.get("photo_ids", [])}}, {"_id": 0}).to_list(50)
    log["photos"] = [serialize(p) for p in photos]
    return log


@api.post("/daily-logs")
async def create_log(body: DailyLogIn, user: dict = Depends(get_current_user)):
    proj = await db.projects.find_one({"id": body.project_id, "company_id": user["company_id"]})
    if not proj:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    if user["role"] == "WORKER" and user["id"] not in proj.get("assigned_worker_ids", []):
        raise HTTPException(status_code=403, detail="Sin acceso al proyecto")
    if len(body.work_description.strip()) < 20:
        raise HTTPException(status_code=400, detail="Descripción mínima 20 caracteres")
    log = {
        "id": str(uuid.uuid4()),
        "company_id": user["company_id"],
        "project_id": body.project_id,
        "worker_id": user["id"],
        "date": body.date or now_utc().isoformat(),
        "hours_worked": body.hours_worked,
        "work_description": body.work_description,
        "weather_condition": body.weather_condition,
        "progress_percentage": body.progress_percentage,
        "incidents": body.incidents,
        "photo_ids": body.photo_ids,
        "material_entry_ids": body.material_entry_ids,
        "status": "PENDING",
        "review_comment": "",
        "submitted_at": now_utc(),
        "approved_by": None,
        "approved_at": None,
    }
    await db.daily_logs.insert_one(log.copy())
    # auto alert if incident
    if body.incidents and body.incidents.strip():
        await db.alerts.insert_one({
            "id": str(uuid.uuid4()),
            "company_id": user["company_id"],
            "type": "INCIDENT_REPORTED",
            "severity": "WARNING",
            "message": f"Incidente reportado en {proj['name']} por {user['name']}",
            "project_id": body.project_id,
            "is_read": False,
            "created_at": now_utc(),
        })
    # update project progress
    if body.progress_percentage and body.progress_percentage > proj.get("progress_percentage", 0):
        await db.projects.update_one(
            {"id": body.project_id},
            {"$set": {"progress_percentage": body.progress_percentage, "updated_at": now_utc()}},
        )
    return serialize(log)


@api.patch("/daily-logs/{log_id}/review")
async def review_log(log_id: str, body: LogReviewIn, user: dict = Depends(require_role("ADMIN", "MANAGER"))):
    res = await db.daily_logs.update_one(
        {"id": log_id, "company_id": user["company_id"]},
        {"$set": {
            "status": body.status,
            "review_comment": body.review_comment or "",
            "approved_by": user["id"],
            "approved_at": now_utc(),
        }},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Parte no encontrado")
    log = await db.daily_logs.find_one({"id": log_id}, {"_id": 0})
    return serialize(log)


# =========================================================
# Photos
# =========================================================
@api.get("/photos")
async def list_photos(
    project_id: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    flt: dict = {"company_id": user["company_id"]}
    if project_id:
        flt["project_id"] = project_id
    if user["role"] == "WORKER":
        flt["worker_id"] = user["id"]
    photos = await db.project_photos.find(flt).sort("taken_at", -1).to_list(500)
    out = []
    for p in photos:
        p = serialize(p)
        worker = await db.users.find_one({"id": p["worker_id"]}, {"_id": 0, "password_hash": 0})
        p["worker"] = serialize(worker) if worker else None
        out.append(p)
    return out


@api.post("/photos")
async def upload_photo(body: PhotoIn, user: dict = Depends(get_current_user)):
    proj = await db.projects.find_one({"id": body.project_id, "company_id": user["company_id"]})
    if not proj:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    if user["role"] == "WORKER" and user["id"] not in proj.get("assigned_worker_ids", []):
        raise HTTPException(status_code=403, detail="Sin acceso al proyecto")
    p = {
        "id": str(uuid.uuid4()),
        "company_id": user["company_id"],
        "project_id": body.project_id,
        "daily_log_id": body.daily_log_id,
        "worker_id": user["id"],
        "image_base64": body.image_base64,
        "caption": body.caption,
        "photo_type": body.photo_type,
        "taken_at": now_utc(),
        "uploaded_at": now_utc(),
    }
    await db.project_photos.insert_one(p.copy())
    return serialize(p)


@api.delete("/photos/{pid}")
async def delete_photo(pid: str, user: dict = Depends(get_current_user)):
    photo = await db.project_photos.find_one({"id": pid, "company_id": user["company_id"]})
    if not photo:
        raise HTTPException(status_code=404, detail="Foto no encontrada")
    if user["role"] == "WORKER" and photo["worker_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Sin permiso")
    await db.project_photos.delete_one({"id": pid})
    return {"ok": True}


# =========================================================
# Dashboard / alerts / reports
# =========================================================
@api.get("/dashboard/summary")
async def dashboard_summary(user: dict = Depends(require_role("ADMIN", "MANAGER"))):
    cid = user["company_id"]
    today = datetime(now_utc().year, now_utc().month, now_utc().day, tzinfo=timezone.utc)
    week_start = today - timedelta(days=today.weekday())
    month_start = datetime(now_utc().year, now_utc().month, 1, tzinfo=timezone.utc)
    active = await db.projects.count_documents({"company_id": cid, "status": "ACTIVE"})
    workers_today = await db.daily_logs.distinct(
        "worker_id", {"company_id": cid, "date": {"$gte": today.isoformat()}}
    )
    pending_logs = await db.daily_logs.count_documents({"company_id": cid, "status": "PENDING"})
    open_alerts = await db.alerts.count_documents({"company_id": cid, "is_read": False})
    week_pipeline = [
        {"$match": {"company_id": cid, "created_at": {"$gte": week_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$total_cost"}}},
    ]
    month_pipeline = [
        {"$match": {"company_id": cid, "created_at": {"$gte": month_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$total_cost"}}},
    ]
    week_res = await db.material_entries.aggregate(week_pipeline).to_list(1)
    month_res = await db.material_entries.aggregate(month_pipeline).to_list(1)
    week_spend = round(week_res[0]["total"], 2) if week_res else 0.0
    month_spend = round(month_res[0]["total"], 2) if month_res else 0.0
    # spend by project (last 30 days)
    last30 = now_utc() - timedelta(days=30)
    spend_pipe = [
        {"$match": {"company_id": cid, "created_at": {"$gte": last30}}},
        {"$group": {"_id": "$project_id", "total": {"$sum": "$total_cost"}}},
        {"$sort": {"total": -1}},
        {"$limit": 6},
    ]
    spend_by_proj = await db.material_entries.aggregate(spend_pipe).to_list(6)
    chart = []
    for s in spend_by_proj:
        proj = await db.projects.find_one({"id": s["_id"]}, {"_id": 0, "name": 1})
        chart.append({"project": (proj or {}).get("name", "—"), "amount": round(s["total"], 2)})
    # today's photo activity
    today_photos = await db.project_photos.find(
        {"company_id": cid, "uploaded_at": {"$gte": today}}
    ).sort("uploaded_at", -1).to_list(10)
    photo_feed = []
    for ph in today_photos:
        ph = serialize(ph)
        w = await db.users.find_one({"id": ph["worker_id"]}, {"_id": 0, "password_hash": 0})
        proj = await db.projects.find_one({"id": ph["project_id"]}, {"_id": 0, "name": 1})
        photo_feed.append({
            "id": ph["id"],
            "worker_name": (w or {}).get("name"),
            "project_name": (proj or {}).get("name"),
            "photo_type": ph.get("photo_type"),
            "image_base64": ph.get("image_base64"),
            "uploaded_at": ph.get("uploaded_at"),
        })
    return {
        "active_projects": active,
        "workers_today": len(workers_today),
        "week_spend": week_spend,
        "month_spend": month_spend,
        "pending_logs": pending_logs,
        "open_alerts": open_alerts,
        "spend_by_project": chart,
        "photo_feed": photo_feed,
    }


@api.get("/alerts")
async def list_alerts(user: dict = Depends(require_role("ADMIN", "MANAGER"))):
    alerts = await db.alerts.find({"company_id": user["company_id"]}).sort("created_at", -1).to_list(200)
    return [serialize(a) for a in alerts]


@api.patch("/alerts/{aid}/read")
async def mark_alert_read(aid: str, user: dict = Depends(require_role("ADMIN", "MANAGER"))):
    await db.alerts.update_one({"id": aid, "company_id": user["company_id"]}, {"$set": {"is_read": True}})
    return {"ok": True}


@api.get("/reports/weekly")
async def list_weekly_reports(user: dict = Depends(require_role("ADMIN", "MANAGER"))):
    reports = await db.weekly_reports.find({"company_id": user["company_id"]}).sort("week_start", -1).to_list(50)
    return [serialize(r) for r in reports]


@api.post("/reports/weekly/generate")
async def generate_weekly_report(user: dict = Depends(require_role("ADMIN", "MANAGER"))):
    cid = user["company_id"]
    today = now_utc()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)
    pipe_spend = [
        {"$match": {"company_id": cid, "created_at": {"$gte": week_start, "$lte": week_end}}},
        {"$group": {"_id": "$project_id", "spend": {"$sum": "$total_cost"}}},
    ]
    spend = await db.material_entries.aggregate(pipe_spend).to_list(100)
    total_spend = round(sum(s["spend"] for s in spend), 2)
    log_count = await db.daily_logs.count_documents(
        {"company_id": cid, "submitted_at": {"$gte": week_start, "$lte": week_end}}
    )
    incident_count = await db.daily_logs.count_documents(
        {"company_id": cid, "submitted_at": {"$gte": week_start, "$lte": week_end}, "incidents": {"$nin": [None, ""]}}
    )
    photo_count = await db.project_photos.count_documents(
        {"company_id": cid, "uploaded_at": {"$gte": week_start, "$lte": week_end}}
    )
    summary = {
        "total_spend": total_spend,
        "log_count": log_count,
        "incident_count": incident_count,
        "photo_count": photo_count,
        "by_project": [{"project_id": s["_id"], "spend": round(s["spend"], 2)} for s in spend],
    }
    rep = {
        "id": str(uuid.uuid4()),
        "company_id": cid,
        "week_start": week_start,
        "week_end": week_end,
        "generated_at": now_utc(),
        "pdf_url": None,
        "excel_url": None,
        "summary": summary,
    }
    await db.weekly_reports.insert_one(rep.copy())
    return serialize(rep)


# =========================================================
# Health
# =========================================================
@api.get("/")
async def root():
    return {"app": "GLASSWORK", "ok": True}


# =========================================================
# Seeding
# =========================================================
SPANISH_MATERIALS = [
    # (name, unit, category, unit_price, supplier)
    ("Perfil Cortizo Serie 70 Marco", "m", "PERFILERIA", 18.50, "Cortizo"),
    ("Perfil Cortizo Serie 70 Hoja", "m", "PERFILERIA", 19.20, "Cortizo"),
    ("Perfil Cortizo COR-60 Marco", "m", "PERFILERIA", 14.80, "Cortizo"),
    ("Perfil Technal Soleal", "m", "PERFILERIA", 22.10, "Technal"),
    ("Perfil corredera Schüco ASS 50", "m", "PERFILERIA", 25.40, "Schüco"),
    ("Perfil oscilobatiente Reynaers", "m", "PERFILERIA", 27.90, "Reynaers"),
    ("Junquillo aluminio anodizado", "m", "PERFILERIA", 3.20, "Cortizo"),
    ("Tapa Junta Cortizo", "m", "PERFILERIA", 2.80, "Cortizo"),
    ("Vidrio laminar 6+6 incoloro", "m2", "VIDRIO", 68.00, "Saint-Gobain"),
    ("Vidrio laminar 8+8 acústico", "m2", "VIDRIO", 95.00, "Guardian"),
    ("Vidrio templado 10mm", "m2", "VIDRIO", 78.00, "Saint-Gobain"),
    ("Vidrio Climalit 4/16/4 bajo emisivo", "m2", "VIDRIO", 72.50, "Saint-Gobain"),
    ("Vidrio Climalit 6/20/6 control solar", "m2", "VIDRIO", 92.00, "Guardian"),
    ("Vidrio espejo 5mm", "m2", "VIDRIO", 35.00, "Saint-Gobain"),
    ("Vidrio mate ácido 6mm", "m2", "VIDRIO", 56.00, "Saint-Gobain"),
    ("Vidrio templado curvo", "m2", "VIDRIO", 145.00, "Cricursa"),
    ("Herraje corredera Roto Patio", "ud", "HERRAJES", 145.00, "Roto"),
    ("Herraje oscilobatiente Roto NT", "ud", "HERRAJES", 85.00, "Roto"),
    ("Cierre embutido Giesse", "ud", "HERRAJES", 32.50, "Giesse"),
    ("Manilla Hoppe Atlanta", "ud", "HERRAJES", 28.40, "Hoppe"),
    ("Manilla con llave Tesa", "ud", "HERRAJES", 45.00, "Tesa"),
    ("Bisagra oculta Anuba", "ud", "HERRAJES", 18.00, "Anuba"),
    ("Compás limitador apertura", "ud", "HERRAJES", 22.00, "Roto"),
    ("Cremona corredera elevable", "ud", "HERRAJES", 95.00, "GU"),
    ("Cerradura embutir multipunto", "ud", "HERRAJES", 165.00, "Tesa"),
    ("Silicona neutra Bostik N3500", "ud", "SELLANTES", 7.20, "Bostik"),
    ("Silicona estructural Sika SG500", "ud", "SELLANTES", 14.50, "Sika"),
    ("Silicona acética transparente", "ud", "SELLANTES", 5.80, "Pattex"),
    ("Espuma de poliuretano profesional", "ud", "SELLANTES", 9.50, "Sika"),
    ("Cinta butilo doble cara", "m", "SELLANTES", 4.20, "3M"),
    ("Junta EPDM marco", "m", "SELLANTES", 1.80, "Hutchinson"),
    ("Junta acristalamiento perimetral", "m", "SELLANTES", 2.10, "Hutchinson"),
    ("Imprimación silicona", "ud", "SELLANTES", 18.00, "Sika"),
    ("Taladro percutor Bosch GSB 18V", "ud", "HERRAMIENTAS", 220.00, "Bosch"),
    ("Pistola silicona profesional", "ud", "HERRAMIENTAS", 38.00, "Bostik"),
    ("Ventosa doble vidrio 80kg", "ud", "HERRAMIENTAS", 145.00, "Bohle"),
    ("Cortador vidrio ruleta", "ud", "HERRAMIENTAS", 22.00, "Bohle"),
    ("Nivel láser autonivelante", "ud", "HERRAMIENTAS", 285.00, "Bosch"),
    ("Calzo regulable PVC", "caja", "CONSUMIBLES", 12.00, "Reca"),
    ("Tornillo autoperforante 4.8x25", "caja", "CONSUMIBLES", 8.50, "Reca"),
    ("Tornillo cabeza avellanada 4x40", "caja", "CONSUMIBLES", 6.20, "Reca"),
    ("Taco metálico expansión", "caja", "CONSUMIBLES", 14.00, "Fischer"),
    ("Taco nylon SX 8", "caja", "CONSUMIBLES", 9.40, "Fischer"),
    ("Disco corte aluminio", "ud", "CONSUMIBLES", 4.80, "Bosch"),
    ("Disco corte vidrio diamante", "ud", "CONSUMIBLES", 38.00, "Bosch"),
    ("Bayeta microfibra", "caja", "CONSUMIBLES", 18.00, "Vileda"),
    ("Limpiador vidrio profesional", "l", "CONSUMIBLES", 6.50, "Bohle"),
    ("Cinta señalización obra", "ud", "OTROS", 4.20, "Reca"),
    ("Casco protección EPI", "ud", "OTROS", 22.00, "3M"),
    ("Guantes anticorte vidrio", "ud", "OTROS", 8.50, "Mapa"),
]


SAMPLE_PHOTO_BASE64 = (
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAfbLI3wAAAABJRU5ErkJggg=="
)


async def ensure_indexes():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("company_id")
    await db.projects.create_index("company_id")
    await db.material_entries.create_index([("company_id", 1), ("project_id", 1)])
    await db.daily_logs.create_index([("company_id", 1), ("worker_id", 1)])
    await db.project_photos.create_index([("company_id", 1), ("project_id", 1)])


async def seed():
    if await db.users.count_documents({}) > 0:
        return
    logger.info("Seeding GLASSWORK demo data ...")
    company_id = str(uuid.uuid4())
    company = {
        "id": company_id,
        "name": "Aluminios Elegant Glass",
        "logo": None,
        "address": "Calvià, Mallorca",
        "phone": "+34 971 22 33 44",
        "email": "info@elegantglass.es",
        "created_at": now_utc(),
    }
    await db.companies.insert_one(company)

    admin_id = str(uuid.uuid4())
    admin = {
        "id": admin_id,
        "name": "Joan Martí",
        "email": os.environ["ADMIN_EMAIL"].lower(),
        "password_hash": hash_password(os.environ["ADMIN_PASSWORD"]),
        "role": "ADMIN",
        "company_id": company_id,
        "phone": "+34 600 11 22 33",
        "avatar": None,
        "is_active": True,
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    workers = []
    for nm, em in [
        ("Carlos Ramírez", "carlos@elegantglass.es"),
        ("Miguel Soler", "miguel@elegantglass.es"),
        ("Lucía Fernández", "lucia@elegantglass.es"),
    ]:
        workers.append({
            "id": str(uuid.uuid4()),
            "name": nm,
            "email": em,
            "password_hash": hash_password("Worker1234!"),
            "role": "WORKER",
            "company_id": company_id,
            "phone": "",
            "avatar": None,
            "is_active": True,
            "created_at": now_utc(),
            "updated_at": now_utc(),
        })
    await db.users.insert_many([admin] + workers)

    # Materials catalog
    materials = []
    for nm, unit, cat, price, supplier in SPANISH_MATERIALS:
        materials.append({
            "id": str(uuid.uuid4()),
            "company_id": company_id,
            "name": nm,
            "unit": unit,
            "category": cat,
            "unit_price": price,
            "supplier": supplier,
            "notes": "",
            "is_archived": False,
            "created_at": now_utc(),
        })
    await db.materials.insert_many(materials)

    # 4 projects
    project_defs = [
        ("Reforma Hotel Son Vida", "ACTIVE", 85000, "Son Vida Resort SL", "+34 971 78 33 22", 65, [workers[0]["id"], workers[1]["id"]], "Calle Son Vida 12, Palma"),
        ("Cerramiento terraza Port d'Andratx", "ACTIVE", 28500, "Familia Pons", "+34 690 22 33 44", 30, [workers[2]["id"]], "Avinguda Mateo Bosch, Andratx"),
        ("Fachada Edificio Avinguda Jaume III", "PENDING", 152000, "Inmobiliaria Mallorca SA", "+34 971 12 99 88", 0, [workers[0]["id"], workers[2]["id"]], "Avinguda Jaume III, Palma"),
        ("Carpintería Villa Cala Vinyes", "PAUSED", 47500, "Müller Family Trust", "+34 660 55 66 77", 45, [workers[1]["id"]], "Camí de Cala Vinyes 8, Calvià"),
    ]
    projects = []
    for nm, st, budget, cli, phone, prog, w_ids, addr in project_defs:
        projects.append({
            "id": str(uuid.uuid4()),
            "company_id": company_id,
            "name": nm,
            "description": f"Instalación profesional de carpintería de aluminio y vidrio.",
            "address": addr,
            "lat": 39.55 + (len(projects) * 0.02),
            "lng": 2.62 + (len(projects) * 0.02),
            "status": st,
            "start_date": (now_utc() - timedelta(days=45)).isoformat(),
            "end_date": (now_utc() + timedelta(days=30)).isoformat(),
            "actual_end_date": None,
            "budget": budget,
            "client_name": cli,
            "client_phone": phone,
            "client_email": "",
            "notes": "",
            "assigned_worker_ids": w_ids,
            "manager_id": admin_id,
            "progress_percentage": prog,
            "cover_photo": None,
            "created_at": now_utc() - timedelta(days=50 - len(projects) * 5),
            "updated_at": now_utc(),
        })
    await db.projects.insert_many(projects)

    # 20 daily logs across active projects
    logs = []
    weather_opts = ["SUNNY", "CLOUDY", "WINDY", "RAINY", "SUNNY", "SUNNY"]
    desc_pool = [
        "Instalación de marcos en planta primera, ajuste y nivelación de perfiles.",
        "Acristalamiento de fachada sur, sellado perimetral con silicona neutra.",
        "Mediciones in situ y replanteo de huecos para ventanas correderas.",
        "Colocación de herrajes oscilobatiente y prueba de funcionamiento.",
        "Sellado interior y exterior, limpieza final del vidrio instalado.",
        "Montaje de barandillas de vidrio templado en terraza.",
        "Desmontaje de carpintería antigua y preparación del hueco.",
        "Instalación de vidrio Climalit en ventanas dormitorios.",
    ]
    for i in range(20):
        proj = projects[i % 2]  # active projects only
        worker = workers[i % 3]
        d = now_utc() - timedelta(days=i)
        log = {
            "id": str(uuid.uuid4()),
            "company_id": company_id,
            "project_id": proj["id"],
            "worker_id": worker["id"],
            "date": d.isoformat(),
            "hours_worked": [6, 7.5, 8, 8, 4.5, 8][i % 6],
            "work_description": desc_pool[i % len(desc_pool)],
            "weather_condition": weather_opts[i % len(weather_opts)],
            "progress_percentage": min(100, 30 + i * 3),
            "incidents": "Pequeño desperfecto en perfil, repuesto." if i == 5 else None,
            "photo_ids": [],
            "material_entry_ids": [],
            "status": "APPROVED" if i > 3 else "PENDING",
            "review_comment": "",
            "submitted_at": d,
            "approved_by": admin_id if i > 3 else None,
            "approved_at": d if i > 3 else None,
        }
        logs.append(log)
    await db.daily_logs.insert_many(logs)

    # 30 photos (placeholders, base64 1px)
    photos = []
    types = ["PROGRESS", "BEFORE", "AFTER", "INCIDENT", "MATERIAL", "MEASUREMENT"]
    captions = [
        "Avance de instalación", "Estado previo del hueco", "Acabado final",
        "Detalle del sellado", "Acopio de material", "Medición de hueco",
    ]
    for i in range(30):
        proj = projects[i % 2]
        worker = workers[i % 3]
        photos.append({
            "id": str(uuid.uuid4()),
            "company_id": company_id,
            "project_id": proj["id"],
            "daily_log_id": logs[i % len(logs)]["id"],
            "worker_id": worker["id"],
            "image_base64": SAMPLE_PHOTO_BASE64,
            "caption": captions[i % len(captions)],
            "photo_type": types[i % len(types)],
            "taken_at": now_utc() - timedelta(days=i // 2),
            "uploaded_at": now_utc() - timedelta(days=i // 2),
        })
    await db.project_photos.insert_many(photos)

    # Material entries (~30 across projects)
    entries = []
    for i in range(40):
        proj = projects[i % 4]
        mat = materials[i % len(materials)]
        worker = workers[i % 3]
        qty = [1, 2, 4, 8, 12, 0.5, 1.5][i % 7]
        entries.append({
            "id": str(uuid.uuid4()),
            "company_id": company_id,
            "project_id": proj["id"],
            "material_id": mat["id"],
            "quantity": qty,
            "unit_price": mat["unit_price"],
            "total_cost": round(qty * mat["unit_price"], 2),
            "type": ["USAGE", "PURCHASE", "USAGE", "RETURN"][i % 4],
            "worker_id": worker["id"],
            "date": (now_utc() - timedelta(days=i // 3)).isoformat(),
            "notes": "",
            "receipt_photo": None,
            "created_at": now_utc() - timedelta(days=i // 3),
        })
    await db.material_entries.insert_many(entries)

    # Alerts
    alerts = [
        {
            "id": str(uuid.uuid4()),
            "company_id": company_id,
            "type": "BUDGET_EXCEEDED",
            "severity": "WARNING",
            "message": "Reforma Hotel Son Vida ha superado el 80% del presupuesto.",
            "project_id": projects[0]["id"],
            "is_read": False,
            "created_at": now_utc() - timedelta(hours=4),
        },
        {
            "id": str(uuid.uuid4()),
            "company_id": company_id,
            "type": "INCIDENT_REPORTED",
            "severity": "WARNING",
            "message": "Incidente reportado en Cerramiento terraza Port d'Andratx.",
            "project_id": projects[1]["id"],
            "is_read": False,
            "created_at": now_utc() - timedelta(hours=14),
        },
        {
            "id": str(uuid.uuid4()),
            "company_id": company_id,
            "type": "LOG_MISSING",
            "severity": "INFO",
            "message": "Lucía Fernández no ha enviado parte hoy.",
            "project_id": None,
            "is_read": False,
            "created_at": now_utc() - timedelta(hours=2),
        },
    ]
    await db.alerts.insert_many(alerts)

    # 2 weekly reports
    reports = []
    for w in range(2):
        ws = now_utc() - timedelta(days=7 * (w + 1))
        we = ws + timedelta(days=6)
        reports.append({
            "id": str(uuid.uuid4()),
            "company_id": company_id,
            "week_start": ws,
            "week_end": we,
            "generated_at": we,
            "pdf_url": None,
            "excel_url": None,
            "summary": {
                "total_spend": 4250.50 + w * 500,
                "log_count": 14 - w,
                "incident_count": 1 if w == 0 else 0,
                "photo_count": 22 - w * 3,
                "by_project": [],
            },
        })
    await db.weekly_reports.insert_many(reports)
    logger.info("Seed completed.")


@app.on_event("startup")
async def startup():
    await ensure_indexes()
    await seed()


@app.on_event("shutdown")
async def shutdown():
    client.close()


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
