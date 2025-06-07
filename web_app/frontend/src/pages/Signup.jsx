import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext"; 

const Signup = () => {
  const navigate = useNavigate();
  const { authFetch } = useAuth(); // use the shared authenticated fetch
  const [formData, setFormData] = useState({ email: "", password: "", display_name: "" });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const passwordRules = useMemo(() => (
    [
      {
        key: "length",
        label: "At least 8 characters",
        test: (p) => p.length >= 8,
      },
      {
        key: "uppercase",
        label: "Contains an uppercase letter",
        test: (p) => /[A-Z]/.test(p),
      },
      {
        key: "number",
        label: "Contains a number",
        test: (p) => /\d/.test(p),
      },
      {
        key: "special",
        label: "Contains a special character",
        test: (p) => /[^A-Za-z0-9]/.test(p),
      },
    ]
  ), []);

  const passwordValidity = useMemo(() => {
    const p = formData.password || "";
    return passwordRules.map((r) => ({ key: r.key, label: r.label, ok: r.test(p) }));
  }, [formData.password, passwordRules]);

  const isPasswordValid = useMemo(() => passwordValidity.every((r) => r.ok), [passwordValidity]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    // Block submit if password invalid
    if (!isPasswordValid) {
      setPasswordTouched(true);
      setError("Password does not meet the requirements.");
      return;
    }
    setLoading(true);

    try {
      await authFetch("/accounts/register/", {
        method: "POST",
        body: JSON.stringify(formData),
      }, true);
      navigate("/login", {
        state: { message: "Registration successful! Please log in." },
      });
    } catch (err) {
      console.error("Signup error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-200">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6">
        <div className="card w-full max-w-md bg-base-100 shadow-xl">
          <div className="card-body gap-6">
            <div className="space-y-2 text-center">
              <h1 className="text-3xl font-bold">Create your account</h1>
              <p className="text-sm text-base-content/70">
                Set up your trading profile and start tracking markets immediately.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded">{error}</div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="form-control w-full">
                <span className="label-text">Email</span>
                <input
                  name="email"
                  type="email"
                  placeholder="user@example.com"
                  className="input input-bordered w-full"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </label>

              <label className="form-control w-full">
                <span className="label-text">Display Name</span>
                <input
                  name="display_name"
                  type="text"
                  placeholder="John Doe"
                  className="input input-bordered w-full"
                  value={formData.display_name}
                  onChange={handleChange}
                  required
                />
              </label>

              <label className="form-control w-full">
                <span className="label-text">Password</span>
                <input
                  name="password"
                  type="password"
                  placeholder="Enter your password"
                  className="input input-bordered w-full"
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={() => setPasswordTouched(true)}
                  required
                />
              </label>

              {(passwordTouched || formData.password) && (
                <div className="space-y-1">
                  {passwordValidity.map((r) => (
                    <div key={r.key} className={`text-sm ${r.ok ? "text-green-600" : "text-red-600"}`}>
                      {r.ok ? "✓" : "✗"} {r.label}
                    </div>
                  ))}
                </div>
              )}

              <button type="submit" disabled={loading || !isPasswordValid} className="btn btn-primary w-full">
                {loading ? "Creating Account..." : "Create account"}
              </button>
            </form>

            <p className="text-center text-sm text-base-content/70">
              Already have an account?{" "}
              <Link to="/login" className="link link-primary">
                Log In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
