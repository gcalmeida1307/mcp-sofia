from pathlib import Path

from openpyxl import Workbook

from server import parse_tabular_rows


def test_csv_semicolon_utf8_duplicates_and_nulls(tmp_path: Path):
    path = tmp_path / "dados.csv"
    path.write_text("Nome;Nome;Idade\nJoão;;31\nMaria;Silva;\n", encoding="utf-8")
    rows = parse_tabular_rows(path)
    assert rows[0]["Nome"] == "João"
    assert rows[0]["Nome_2"] == ""
    assert rows[1]["Idade"] == ""


def test_tsv_and_large_generated_input_are_bounded(tmp_path: Path):
    path = tmp_path / "grande.tsv"
    path.write_text("id\tvalor\n" + "\n".join(f"{i}\t{i * 2}" for i in range(12000)), encoding="utf-8")
    rows = parse_tabular_rows(path)
    assert len(rows) == 10000
    assert rows[9999]["id"] == "9999"


def test_xlsx_read_only_does_not_execute_formulas(tmp_path: Path):
    path = tmp_path / "planilha.xlsx"
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(["item", "valor"])
    sheet.append(["seguro", "=1+1"])
    workbook.save(path)
    rows = parse_tabular_rows(path)
    assert rows[0]["item"] == "seguro"
    assert rows[0]["valor"] in {"", "None"}


def test_empty_and_corrupt_files_are_safe(tmp_path: Path):
    empty = tmp_path / "empty.csv"
    empty.write_bytes(b"")
    assert parse_tabular_rows(empty) == []
    corrupt = tmp_path / "corrupt.xlsx"
    corrupt.write_bytes(b"not-a-real-xlsx")
    try:
        parse_tabular_rows(corrupt)
    except Exception as exc:
        assert type(exc).__name__ in {"BadZipFile", "InvalidFileException"}
