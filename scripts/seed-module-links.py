"""Register the initial public-source catalog without downloading anything."""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server


def main() -> None:
    catalog = json.loads((server.PROJECT_ROOT / "docs" / "module-seed-links.json").read_text(encoding="utf-8"))
    engine = server.database_engine()
    if engine is None:
        raise SystemExit("DATABASE_URL não configurada.")
    inserted = 0
    with engine.begin() as connection:
        for module_name, links in catalog["modules"].items():
            server.ensure_module_structure(module_name)
            for item in links:
                url = str(item["url"]).strip()
                source_key = f"seed:{module_name}:{url}"
                exists = connection.execute(text("SELECT 1 FROM knowledge_sources WHERE module_name=:module AND source_key=:key AND is_current AND deleted_at IS NULL LIMIT 1"), {"module": module_name, "key": source_key}).first()
                if exists:
                    continue
                connection.execute(text("""INSERT INTO knowledge_sources
                    (module_name,bucket,original_name,storage_path,source_url,mime_type,sha256,source_key,version_no,is_current,size_bytes,processing_status)
                    VALUES (:module,'links',:name,:path,:url,'text/uri-list',:sha,:key,1,true,0,'PENDENTE')"""), {
                    "module": module_name,
                    "name": str(item["title"])[:180],
                    "path": str(server.knowledge_directory(module_name, "links") / (hashlib.sha256(url.encode()).hexdigest()[:16] + ".txt")),
                    "url": url,
                    "sha": hashlib.sha256(url.encode()).hexdigest(),
                    "key": source_key,
                })
                inserted += 1
    engine.dispose()
    print(f"SEED_LINKS_INSERTED={inserted}")


if __name__ == "__main__":
    main()
