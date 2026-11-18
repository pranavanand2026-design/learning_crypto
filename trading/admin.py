from django.contrib import admin

from .models import Account, Position, Trade, TradeNote


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ("user", "cash", "starting_cash", "started_at", "restarts")


@admin.register(Position)
class PositionAdmin(admin.ModelAdmin):
    list_display = ("account", "symbol", "quantity", "cost_basis")


@admin.register(Trade)
class TradeAdmin(admin.ModelAdmin):
    list_display = ("account", "side", "symbol", "quantity", "price", "fee", "created_at")
    list_filter = ("side",)


admin.site.register(TradeNote)
