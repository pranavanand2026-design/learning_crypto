import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from web_app.models import User


def test_health_check():
    client = APIClient()
    url = reverse("health-check")
    res = client.get(url)
    assert res.status_code == 200
    body = res.json()
    assert body.get("code") == 0
    assert body.get("status") == "ok"


def test_profile_requires_auth():
    client = APIClient()
    url = reverse("profile")
    res = client.get(url)
    assert res.status_code in (401, 403)


@pytest.mark.django_db
def test_simulation_create_and_list():
    client = APIClient()
    user = User.objects.create_user(email="tester@example.com", username="tester@example.com", password="pass123", display_name="Tester")
    client.force_authenticate(user=user)

    create_url = reverse("simulations")
    payload = {
        "name": "pytest sim",
        "start_date": timezone.now().date().isoformat(),
        "description": "created by test",
    }
    res = client.post(create_url, payload, format="json")
    assert res.status_code == 201, res.content
    sim_id = res.json().get("id")
    assert sim_id

    list_res = client.get(create_url)
    assert list_res.status_code == 200
    data = list_res.json()
    # list may be plain array; accept both
    items = data if isinstance(data, list) else data.get("results", [])
    assert isinstance(items, list)
    assert any(item.get("id") == sim_id for item in items)


@pytest.mark.django_db
def test_admin_metrics_staff_only():
    client = APIClient()
    staff = User.objects.create_user(email="staff@example.com", username="staff@example.com", password="pass123", display_name="Staff")
    staff.is_staff = True
    staff.save()
    client.force_authenticate(user=staff)
    res = client.get("/api/admin/metrics/")
    assert res.status_code == 200
    body = res.json()
    assert "total_users" in body
    assert "total_simulations" in body
    assert "total_transactions" in body
