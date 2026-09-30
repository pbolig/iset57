#!/usr/bin/env python3
"""
Script para convertir 'materias-correlatividades-docentes.xlsx' a formato JSON
y actualizar tanto 'materias.json' como 'data.json' automáticamente.
"""
import json
import os
import sys

try:
    import openpyxl
except ImportError:
    print("Error: openpyxl no está instalado. Instálalo con: pip install openpyxl")
    sys.exit(1)

EXCEL_FILE = "materias-correlatividades-docentes.xlsx"
DATA_JSON = "data.json"
MATERIAS_JSON = "materias.json"

career_map = {
    "2019/1983": {"id": "digitales", "titulo": "Tecnicatura Superior en Tecnologías Digitales"},
    "3012/2002": {"id": "higiene", "titulo": "Tecnicatura Superior en Higiene y Seguridad en el Trabajo"},
    "756/2011":  {"id": "enfermeria", "titulo": "Tecnicatura Superior en Enfermería"}
}

def convertir():
    if not os.path.exists(EXCEL_FILE):
        print(f"Error: No se encontró el archivo {EXCEL_FILE}")
        sys.exit(1)

    print(f"Leyendo {EXCEL_FILE}...")
    wb = openpyxl.load_workbook(EXCEL_FILE)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))

    result = {}

    for r in rows[3:]:
        if not r or not r[0]:
            continue
        raw_career = str(r[0]).strip().upper()

        matched_id = None
        for res, info in career_map.items():
            if res in raw_career or info["id"].upper() in raw_career or ("DIGITAL" in raw_career and info["id"] == "digitales") or ("HIGIENE" in raw_career and info["id"] == "higiene") or ("ENFERMER" in raw_career and info["id"] == "enfermeria"):
                matched_id = info["id"]
                break

        if not matched_id:
            continue

        anio_str = str(r[1]).strip() if r[1] is not None else "1"
        carga_str = str(r[2]).strip() if r[2] is not None else ""
        com_a = bool(r[3] and str(r[3]).strip().lower() in ["x", "si", "true", "1"])
        doc_a = str(r[4]).strip() if r[4] is not None else ""
        com_b = bool(r[5] and str(r[5]).strip().lower() in ["x", "si", "true", "1"])
        doc_b = str(r[6]).strip() if r[6] is not None else ""
        com_c = bool(r[7] and str(r[7]).strip().lower() in ["x", "si", "true", "1"])
        doc_c = str(r[8]).strip() if r[8] is not None else ""
        cod_interno = str(r[9]).strip() if r[9] is not None else ""
        materia = str(r[10]).strip() if r[10] is not None else ""
        correlativas = str(r[11]).strip() if r[11] is not None else ""

        comisiones = []
        if com_a: comisiones.append("A")
        if com_b: comisiones.append("B")
        if com_c: comisiones.append("C")

        correlativas_list = []
        if correlativas and correlativas.upper() != "N/A":
            correlativas_list = [c.strip() for c in correlativas.replace(" - ", "-").split("-") if c.strip() and c.strip().upper() != "N/A"]

        materia_obj = {
            "codigo": cod_interno,
            "nombre": materia,
            "anio": anio_str,
            "cargaHoraria": carga_str,
            "comisiones": comisiones,
            "docentes": {
                "A": doc_a,
                "B": doc_b,
                "C": doc_c
            },
            "correlativas": correlativas_list
        }

        result.setdefault(matched_id, []).append(materia_obj)

    # Guardar materias.json
    with open(MATERIAS_JSON, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"Archivo {MATERIAS_JSON} generado con éxito.")

    # Actualizar data.json si existe
    if os.path.exists(DATA_JSON):
        with open(DATA_JSON, "r", encoding="utf-8") as f:
            data = json.load(f)

        if "ofertaAcademica" in data and "espacios" in data["ofertaAcademica"]:
            for esp in data["ofertaAcademica"]["espacios"]:
                eid = esp.get("id")
                if eid in result:
                    esp["materiasDetalladas"] = result[eid]
                    print(f"- {eid}: {len(result[eid])} materias integradas en {DATA_JSON}.")

            with open(DATA_JSON, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"{DATA_JSON} actualizado correctamente.")

if __name__ == "__main__":
    convertir()
