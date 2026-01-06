import { Link } from "react-router-dom";

import Card from "../components/Card";

export default function NotFoundPage() {
  return (
    <div className="container" style={{ padding: "34px 0 54px" }}>
      <Card className="panel">
        <div className="h2">Page not found</div>
        <p className="p" style={{ marginTop: 10 }}>
          The page you’re looking for doesn’t exist.
        </p>
        <div style={{ marginTop: 14 }}>
          <Link className="link" to="/">
            Go back home
          </Link>
        </div>
      </Card>
    </div>
  );
}
