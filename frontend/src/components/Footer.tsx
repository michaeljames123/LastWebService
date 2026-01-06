export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div>
          <div className="brand-name">AgridroneScan</div>
          <div className="small" style={{ marginTop: 6 }}>
            Precision crop monitoring, field by field.
          </div>
        </div>
        <div className="small">© {year} AgridroneScan. All rights reserved.</div>
      </div>
    </footer>
  );
}
