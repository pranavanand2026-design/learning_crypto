from django.urls import path

from . import views

urlpatterns = [
    path("config/", views.app_config, name="app-config"),
    path("market/", views.market_list, name="market-list"),
    path("market/search/", views.market_search, name="market-search"),
    path("market/<str:coin_id>/", views.market_detail, name="market-detail"),
    path("market/<str:coin_id>/chart/", views.market_chart, name="market-chart"),
    path("market/<str:coin_id>/news/", views.market_news, name="market-news"),
    path("news/", views.news_feed, name="news"),
    path("account/", views.account_view, name="account"),
    path("account/rules/", views.account_rules, name="account-rules"),
    path("account/restart/", views.account_restart, name="account-restart"),
    path("quote/", views.quote_view, name="quote"),
    path("orders/", views.orders_view, name="orders"),
    path("journal/", views.journal_view, name="journal"),
    path("journal/<uuid:trade_id>/notes/", views.trade_note, name="trade-note"),
]
