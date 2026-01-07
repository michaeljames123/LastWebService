import { NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import Button from "./Button";

export default function Navbar() {
  const auth = useAuth();
  const navigate = useNavigate();

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? "nav-link active" : "nav-link";

  return (
    <header className="header">
      <div className="container header-inner">
        <div className="brand" onClick={() => navigate("/")} role="button" tabIndex={0}>
          <div className="brand-mark">
            <img src="/AgriDroneScan.png" alt="AgridroneScan logo" className="brand-logo" />
          </div>
          <div>
            <div className="brand-name">AgridroneScan</div>
            <div className="brand-tag">Soil-to-sky intelligence</div>
          </div>
        </div>

        <nav className="nav">
          <NavLink className={navLinkClass} to="/">
            Home
          </NavLink>
          <NavLink className={navLinkClass} to="/about">
            About
          </NavLink>
          <NavLink className={navLinkClass} to="/contact">
            Contact
          </NavLink>
          <NavLink className={navLinkClass} to="/dashboard">
            Dashboard
          </NavLink>
          <NavLink className={navLinkClass} to="/estimate-field">
            Estimate Field
          </NavLink>
        </nav>

        <div className="nav-actions">
          {auth.token ? (
            <>
              {auth.user ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    navigate("/profile");
                  }}
                >
                  {auth.user.full_name || auth.user.username}
                </Button>
              ) : null}
              <Button
                variant="ghost"
                onClick={() => {
                  auth.logout();
                  navigate("/");
                }}
              >
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => navigate("/login")}> 
                Login
              </Button>
              <Button onClick={() => navigate("/register")}>Register</Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
