"""Generates the synthetic CV PDFs used by the extraction and API tests.

Every person, employer and date here is invented. Run inside the test image:
    python tests/fixtures/make_fixtures.py
The generated PDFs are committed so tests never depend on this script's output
changing between ReportLab versions.
"""

from __future__ import annotations

import io
from pathlib import Path

import pypdfium2 as pdfium
from PIL import Image
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

HERE = Path(__file__).parent
PDF_DIR = HERE / "pdf"
WIDTH, HEIGHT = A4
MARGIN = 56


class Writer:
    """Minimal top-down text layout on a ReportLab canvas."""

    def __init__(self, c: canvas.Canvas, x: float = MARGIN, width: float = WIDTH - 2 * MARGIN, top: float = HEIGHT - MARGIN):
        self.c, self.x, self.width, self.y = c, x, width, top

    def heading(self, text: str) -> None:
        self.y -= 10
        self.c.setFont("Helvetica-Bold", 13)
        self.c.drawString(self.x, self.y, text)
        self.y -= 18

    def title(self, text: str) -> None:
        self.c.setFont("Helvetica-Bold", 22)
        self.c.drawString(self.x, self.y, text)
        self.y -= 26

    def line(self, text: str, bold: bool = False, size: int = 10) -> None:
        self.c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
        self.c.drawString(self.x, self.y, text)
        self.y -= size + 5

    def bullet(self, text: str) -> None:
        self.c.setFont("Helvetica", 10)
        self.c.drawString(self.x + 6, self.y, "•")
        self.c.drawString(self.x + 18, self.y, text)
        self.y -= 15

    def gap(self, amount: float = 8) -> None:
        self.y -= amount


def english(w: Writer) -> None:
    w.title("Jane Doe")
    w.line("Senior Backend Engineer")
    w.line("Jakarta, Indonesia")
    w.line("jane.doe@example.com  |  +62 812 3456 7890  |  github.com/janedoe")
    w.heading("Summary")
    w.line("Backend engineer with eight years of experience building payment systems.")
    w.heading("Experience")
    w.line("Senior Backend Engineer, Example Payments", bold=True)
    w.line("Jan 2021 - Present")
    w.bullet("Led the migration of settlement jobs to an event-driven pipeline.")
    w.bullet("Reduced reconciliation time from six hours to forty minutes.")
    w.gap()
    w.line("Software Engineer, Sample Logistics", bold=True)
    w.line("2017 - 2020")
    w.bullet("Built the courier routing service used in twelve cities.")
    w.heading("Education")
    w.line("Universitas Contoh", bold=True)
    w.line("Bachelor of Computer Science, 2013 - 2017")
    w.heading("Skills")
    w.line("Languages: Go, Python, TypeScript")
    w.line("Infrastructure: PostgreSQL, Kafka, Kubernetes")


def indonesian(w: Writer) -> None:
    w.title("Budi Santoso")
    w.line("Analis Data")
    w.line("Bandung, Jawa Barat")
    w.line("budi.santoso@example.com  |  0812-9876-5432")
    w.heading("Ringkasan")
    w.line("Analis data dengan pengalaman lima tahun di bidang ritel dan logistik.")
    w.heading("Pengalaman Kerja")
    w.line("Analis Data Senior, Toko Contoh", bold=True)
    w.line("Mar 2022 - Sekarang")
    w.bullet("Membangun dasbor penjualan harian untuk tiga ratus cabang.")
    w.bullet("Menurunkan waktu pembuatan laporan bulanan dari tiga hari menjadi empat jam.")
    w.heading("Pendidikan")
    w.line("Institut Teknologi Contoh", bold=True)
    w.line("Sarjana Statistika, 2015 - 2019")
    w.heading("Keahlian")
    w.line("SQL, Python, Tableau, Statistik Inferensial")
    w.heading("Penghargaan")
    w.line("Juara 1 Kompetisi Analitik Nasional, 2018")


def write_en(path: Path) -> None:
    c = canvas.Canvas(str(path), pagesize=A4)
    english(Writer(c))
    c.save()


def write_id(path: Path) -> None:
    c = canvas.Canvas(str(path), pagesize=A4)
    indonesian(Writer(c))
    c.save()


def write_two_column(path: Path) -> None:
    c = canvas.Canvas(str(path), pagesize=A4)
    top = HEIGHT - MARGIN
    sidebar_width = 150
    side = Writer(c, x=MARGIN, width=sidebar_width, top=top)
    side.title("Rina Putri")
    side.heading("Contact")
    side.line("rina.putri@example.com", size=9)
    side.line("+62 811 2222 3333", size=9)
    side.line("linkedin.com/in/rinaputri", size=9)
    side.heading("Skills")
    side.line("Figma", size=9)
    side.line("User Research", size=9)
    side.line("Design Systems", size=9)
    main = Writer(c, x=MARGIN + sidebar_width + 40, width=WIDTH - 2 * MARGIN - sidebar_width - 40, top=top - 36)
    main.heading("Experience")
    main.line("Product Designer, Contoh Studio", bold=True)
    main.line("Feb 2020 - Present")
    main.bullet("Redesigned onboarding, raising activation by a fifth.")
    main.bullet("Maintained the shared component library.")
    main.gap()
    main.line("Junior Designer, Sample Agency", bold=True)
    main.line("2018 - 2020")
    main.bullet("Produced campaign layouts for retail clients.")
    main.heading("Education")
    main.line("Sample Institute of Art", bold=True)
    main.line("Bachelor of Visual Communication, 2014 - 2018")
    c.save()


def write_five_page(path: Path) -> None:
    c = canvas.Canvas(str(path), pagesize=A4)
    for page in range(1, 6):
        w = Writer(c)
        if page == 1:
            w.title("Andi Wijaya")
            w.line("andi.wijaya@example.com")
            w.heading("Experience")
        else:
            w.heading(f"Experience (continued, page {page})")
        for entry in range(1, 4):
            n = (page - 1) * 3 + entry
            w.line(f"Engineer {n}, Example Company {n}", bold=True)
            w.line(f"{2000 + n} - {2001 + n}")
            for b in range(1, 4):
                w.bullet(f"Achievement {b} at company {n}.")
            w.gap()
        c.showPage()
    c.save()


def write_progression(path: Path) -> None:
    """Two-page synthetic CV with mixed employer and role date geometry."""
    c = canvas.Canvas(str(path), pagesize=A4, invariant=1)
    w = Writer(c)
    w.title("MAYA NUSANTARA")
    w.line("Technical Lead/Senior Engineer (Python & TypeScript) - IT Instructor", size=10)
    w.line("Bandung, Indonesia - Email maya@example.com - Phone +62 811 0000 1234", size=9)
    w.line("Portfolio https://example.com/maya", size=9)
    w.heading("Summary")
    w.line("Technical leader delivering public-service software and engineering training.")
    w.heading("Impact Highlights")
    w.bullet("Reduced reporting turnaround while mentoring delivery teams.")
    w.heading("Core Competencies")
    for text in ["Backend: Python, Django, REST APIs", "Frontend: TypeScript, Vue", "Database: PostgreSQL, MySQL",
                 "Infrastructure: Docker, Linux", "Quality: Testing, Code Review", "Leadership: Mentoring, Planning",
                 "Domain: Public services, Education (training, coaching),", "Workflow modernization"]:
        w.line(text, size=9)
    w.heading("Experience")
    w.line("Contoh Learning / PT Contoh Teknologi", bold=True)
    w.line("Role Progression: Training Staff, Software Staff, Engineering Lead", size=9)
    c.setFont("Helvetica", 9)
    c.drawRightString(WIDTH - MARGIN, w.y + 30, "Mar 2018 - Present")
    w.line("Engineering Lead / Software Manager", bold=True)
    c.setFont("Helvetica", 9)
    c.drawRightString(WIDTH - MARGIN, w.y + 15, "Jan 2022 - Present")
    for line in ["Led a multidisciplinary engineering team.", "Established service reliability practices.",
                 "Reviewed architecture and delivery plans.", "Mentored developers across teams."]:
        w.bullet(line)
    c.showPage()
    w = Writer(c)
    w.bullet("Coordinated delivery with public-sector stakeholders.")
    for title, dates, bullets in [
        ("Software Staff (Full Stack Developer)", "Mar 2018 - Jan 2022", ["Built online application workflows.", "Integrated external service APIs.", "Optimized database performance.", "Maintained deployment tooling."]),
        ("Training Staff (Software Engineer Focus)", "Mar 2018 - Dec 2018", ["Prepared engineering course materials.", "Supported practical learning sessions."]),
    ]:
        w.line(title, bold=True)
        c.setFont("Helvetica", 9)
        c.drawRightString(WIDTH - MARGIN, w.y + 15, dates)
        for line in bullets:
            w.bullet(line)
    w.heading("Additional Experience")
    w.line("IT Course Instructor", bold=True)
    c.setFont("Helvetica", 9)
    c.drawRightString(WIDTH - MARGIN, w.y + 15, "Feb 2022 - Present")
    w.bullet("Taught practical backend engineering.")
    w.bullet("Developed hands-on programming exercises.")
    w.heading("Selected Projects")
    for title, dates, description in [
        ("Personnel Portal (CIVIC) (Programmer - Django, Vue, PostgreSQL)", "2020-2021", "Modernized personnel workflows."),
        ("Storm Tracker (METEO) (Programmer - Python, PostgreSQL)", "2021", "Computed nearby lightning coordinates."),
        ("Submission Hub (CIVIC) (Senior Programmer - REST APIs)", "2021-2023", "Reduced submission processing time."),
        ("Lake Atlas (RESEARCH) (Tech Lead - Django, Vue)", "2023", "Centralized environmental records."),
        ("Certificate System (SKILLS) (Tech Lead - Django, MySQL)", "2024-Present", "Directed digital signing delivery."),
    ]:
        w.line(f"{title} {dates}", size=8)
        w.line(description, size=8)
    w.heading("Education")
    w.line("Universitas Contoh - B.Sc. Information Technology 2019 - 2025", size=9)
    w.line("SMK Contoh - Computer & Information Sciences 2015 - 2018", size=9)
    w.heading("Certifications & Awards")
    w.line("Foundation Testing Certificate, Example Board, 2024", size=9)
    w.line("National Service Gold Pin, Civic Agency, 2021", size=9)
    w.heading("Languages")
    w.line("Bahasa Indonesia (Native); English (Conversational)", size=9)
    c.save()


def write_blank(path: Path) -> None:
    c = canvas.Canvas(str(path), pagesize=A4)
    c.showPage()
    c.save()


def write_six_page(path: Path) -> None:
    c = canvas.Canvas(str(path), pagesize=A4)
    for page in range(6):
        c.drawString(MARGIN, HEIGHT - MARGIN, f"Page {page + 1}")
        c.showPage()
    c.save()


def write_encrypted(path: Path) -> None:
    c = canvas.Canvas(str(path), pagesize=A4, encrypt="secret")
    c.drawString(MARGIN, HEIGHT - MARGIN, "Encrypted CV")
    c.save()


def rasterize(source: Path, dpi: int = 200) -> list[Image.Image]:
    doc = pdfium.PdfDocument(str(source))
    try:
        return [page.render(scale=dpi / 72).to_pil().convert("L") for page in doc]
    finally:
        doc.close()


def images_to_pdf(images: list[Image.Image], path: Path, dpi: int = 200) -> None:
    images[0].save(path, "PDF", resolution=dpi, save_all=True, append_images=images[1:])


def write_scanned(path: Path) -> None:
    images_to_pdf(rasterize(PDF_DIR / "en_single.pdf"), path)


def write_mixed(path: Path) -> None:
    """Page 1 has a native text layer; page 2 is an image-only scan."""
    buf = io.BytesIO()
    images_to_pdf(rasterize(PDF_DIR / "id_single.pdf"), Path("/tmp/_scan_page.pdf"))
    native = pdfium.PdfDocument(str(PDF_DIR / "en_single.pdf"))
    scan = pdfium.PdfDocument("/tmp/_scan_page.pdf")
    out = pdfium.PdfDocument.new()
    out.import_pages(native)
    out.import_pages(scan)
    out.save(buf)
    path.write_bytes(buf.getvalue())


def main() -> None:
    PDF_DIR.mkdir(exist_ok=True)
    write_en(PDF_DIR / "en_single.pdf")
    write_id(PDF_DIR / "id_single.pdf")
    write_two_column(PDF_DIR / "two_column.pdf")
    write_five_page(PDF_DIR / "five_page.pdf")
    write_progression(PDF_DIR / "progression.pdf")
    write_scanned(PDF_DIR / "scanned.pdf")
    write_mixed(PDF_DIR / "mixed.pdf")
    write_blank(PDF_DIR / "blank.pdf")
    write_six_page(PDF_DIR / "six_page.pdf")
    write_encrypted(PDF_DIR / "encrypted.pdf")
    (PDF_DIR / "corrupt.pdf").write_bytes(b"%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nthis is not a pdf body\n")
    (PDF_DIR / "not_a_pdf.pdf").write_bytes(b"PK\x03\x04 zip archive renamed to .pdf")


if __name__ == "__main__":
    main()
