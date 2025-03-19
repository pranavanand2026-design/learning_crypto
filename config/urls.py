from django.contrib import admin
from django.urls import path, include
from web_app import views

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("web_app.urls")),

    # legacy non-API routes if still used
    path("accounts/logout/", views.logout_view, name="logout"),
    path("accounts/profile/", views.ProfileView.as_view(), name="profile"),
    path("accounts/password-reset-request/", views.password_reset_request, name="password-reset-request"),
    path("accounts/password-reset-confirm/", views.password_reset_confirm, name="password-reset-confirm"),
    path("health/", views.health_check, name="health-check"),
]
