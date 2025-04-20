from django.urls import path
from . import views

urlpatterns = [
    path("coingecko_proxy/", views.coingecko_proxy, name="coingecko_proxy"),
    # --- Accounts / Authentication ---
    path("accounts/register/", views.RegisterView.as_view(), name="register"),
    path("accounts/login/", views.login_view, name="login"),
    path("accounts/logout/", views.logout_view, name="logout"),
    path("accounts/profile/", views.profile_view, name="profile"),
    path("accounts/change-password/", views.change_password, name="change-password"),
    path("accounts/password-reset-request/", views.password_reset_request, name="password-reset-request"),
    path("accounts/password-reset-confirm/", views.password_reset_confirm, name="password-reset-confirm"),
    path("accounts/refresh/", views.refresh_token, name="token-refresh"),

    # --- CSRF Token ---
    path("csrf/", views.csrf_cookie, name="csrf-cookie"),

    # --- Market Data & Prices ---
    path("markets/", views.market_data, name="market-data"),
    path("prices/current/", views.current_prices, name="current-prices"),
    path("prices/cache/", views.price_history, name="price-cache"),

    # --- Coins ---
    path("coins/", views.CoinListView.as_view(), name="coin-list"),
    path("coins/<str:coin_id>/", views.CoinDetailView.as_view(), name="coin-detail"),

    # --- Watchlist ---
    path("watchlist/", views.WatchlistView.as_view(), name="watchlist"),
    path("watchlist/<uuid:watchlist_id>/", views.WatchlistRemoveView.as_view(), name="watchlist-remove"),

    # --- Portfolio ---
    path("portfolio/", views.portfolio_view, name="portfolio"),
    path("portfolio/sell/", views.portfolio_sell, name="portfolio-sell"),

    # --- Simulations ---
    path("simulations/", views.SimulationListCreateView.as_view(), name="simulations"),
    path("simulations/<uuid:sim_id>/", views.SimulationDetailView.as_view(), name="simulation-detail"),
    path("simulations/<uuid:sim_id>/positions/", views.SimulationPositionsView.as_view(), name="simulation-positions"),
    path("simulations/<uuid:sim_id>/transactions/", views.simulation_transaction, name="simulation-transaction"),
    path("transactions/<uuid:tx_id>/", views.delete_transaction, name="transaction-delete"),

    # --- Transactions ---
    path("transactions/", views.list_transactions, name="transactions-list"),
    path("transactions/create/", views.create_transaction, name="transaction-create"),

    # --- Health Check ---
    path("health/", views.health_check, name="health-check"),
    
    # --- Custom Admin Dashboard (vanilla JS/CSS) ---
    path("admin-dashboard/", views.admin_dashboard_page, name="admin-dashboard"),
    path("admin/metrics/", views.admin_metrics, name="admin-metrics"),
    path("admin/users/", views.admin_users, name="admin-users"),
    path("admin/users/<uuid:user_id>/", views.admin_user_detail, name="admin-user-detail"),
    path("admin/simulations/", views.admin_simulations, name="admin-simulations"),
    path("admin/simulations/<uuid:sim_id>/", views.admin_simulation_detail, name="admin-simulation-detail"),
    path("admin/transactions/", views.admin_transactions, name="admin-transactions"),
    path("admin/transactions/<uuid:tx_id>/", views.admin_transaction_detail, name="admin-transaction-detail"),
    # Admin: prices, holdings, watchlist
    path("admin/current-prices/", views.admin_current_prices, name="admin-current-prices"),
    path("admin/current-prices/<uuid:cp_id>/", views.admin_current_price_detail, name="admin-current-price-detail"),
    path("admin/price-cache/", views.admin_price_cache, name="admin-price-cache"),
    path("admin/price-cache/<uuid:pc_id>/", views.admin_price_cache_detail, name="admin-price-cache-detail"),
    path("admin/holdings/", views.admin_holdings, name="admin-holdings"),
    path("admin/holdings/<uuid:holding_id>/", views.admin_holding_detail, name="admin-holding-detail"),
    path("admin/watchlist/", views.admin_watchlist, name="admin-watchlist"),
    path("admin/watchlist/<uuid:item_id>/", views.admin_watchlist_detail, name="admin-watchlist-detail"),
    
    
]
