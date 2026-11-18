from django.conf import settings
from django.contrib import admin
from django.http import HttpResponse
from django.urls import include, path, re_path
from django.views.decorators.cache import never_cache

from web_app import views


@never_cache
def spa(request):
    """Serve the React app for any client-side route."""
    index = settings.FRONTEND_DIST / "index.html"
    if not index.exists():
        return HttpResponse(
            "Frontend not built. Run `npm run build` in web_app/frontend, or use the Vite dev server.",
            status=503, content_type="text/plain",
        )
    return HttpResponse(index.read_bytes(), content_type="text/html")


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("trading.urls")),
    path("api/", include("web_app.urls")),
    # Legacy non-API routes kept for older clients
    path("accounts/logout/", views.logout_view, name="logout"),
    path("accounts/profile/", views.ProfileView.as_view(), name="profile"),
    path("accounts/password-reset-request/", views.password_reset_request, name="password-reset-request"),
    path("accounts/password-reset-confirm/", views.password_reset_confirm, name="password-reset-confirm"),
    path("health/", views.health_check, name="health-check"),
    re_path(r"^(?!api/|admin/|static/|accounts/).*$", spa, name="spa"),
]
