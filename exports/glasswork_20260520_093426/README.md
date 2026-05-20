# GLASSWORK — Database Export (JSON)

## Cómo restaurar en MongoDB Atlas (o cualquier MongoDB)

Para cada archivo .json en este directorio, ejecuta:

```bash
mongoimport --uri="mongodb+srv://USUARIO:PASS@cluster.xxxxx.mongodb.net/glasswork" \
            --collection="NOMBRE_COLECCION" \
            --file="NOMBRE_COLECCION.json" \
            --jsonArray
```

O todo en bucle:

```bash
for f in *.json; do
  col=$(basename "$f" .json)
  echo "Importing $col..."
  mongoimport --uri="mongodb+srv://USUARIO:PASS@cluster.xxxxx.mongodb.net/glasswork" \
              --collection="$col" \
              --file="$f" \
              --jsonArray
done
```

## Colecciones incluidas

Todos los documentos están en formato `--jsonArray` (un único array JSON por archivo).
Los campos `_id`, `ObjectId`, `Date` y `Binary` están serializados en formato MongoDB Extended JSON v2 (relaxed).
1298	alerts.json
31025	audit_logs.json
493	companies.json
1585	daily_logs.json
5128	login_attempts.json
4	lot_movements.json
4	material_entries.json
4	material_lots.json
4	materials.json
2004	password_reset_tokens.json
4	project_photos.json
2125	projects.json
4	push_tokens.json
4	storage_zones.json
960	token_blacklist.json
4	token_sessions.json
6284	users.json
4	weekly_reports.json
