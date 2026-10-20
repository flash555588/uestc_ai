"""Translate environment observations/raw info, never Agent claims, into facts."""
from .minecraft_state import inventory_items, item_id


def count(info, *keys):
    value = info
    for key in keys:
        if not isinstance(value, dict) or key not in value:
            return None
        value = value[key]
    if isinstance(value, bool) or not isinstance(value, (int, float)) or value < 0 or int(value) != value:
        return None
    return int(value)


def native_counters(info):
    # JSONWorldDataHelper: stat.useItem.minecraft.torch -> stat/use_item/minecraft/torch.
    return count(info, 'stat', 'deaths'), count(info, 'stat', 'use_item', 'minecraft', 'torch')


class EnvironmentEvents:
    def __init__(self, initial_info):
        self.previous_deaths, self.previous_torches = native_counters(initial_info)
        self.event_deaths = 0
        self.initial_deaths = self.previous_deaths
        self.accounted_deaths = 0

    def consume(self, observation, info):
        death_total, torch_total = native_counters(info)
        if 'living_death_event_fired' not in info and death_total is None:
            raise RuntimeError('环境未提供死亡事件或累计死亡计数，不能可靠计分')
        if torch_total is None:
            raise RuntimeError('环境未提供普通火把成功使用统计，不能可靠确认放置')
        # Native event is an edge, reset by the observation producer after each sample.
        # The cumulative stat can arrive later; max avoids counting it twice.
        self.event_deaths += int(bool(info.get('living_death_event_fired', False)))
        stat_deaths = 0
        if death_total is not None:
            if self.initial_deaths is None:
                raise RuntimeError('缺失初始死亡计数，不能建立环境统计基线')
            if death_total < self.initial_deaths:
                raise RuntimeError('死亡统计回退；禁止世界重置或回滚')
            stat_deaths = death_total - self.initial_deaths
        confirmed = max(self.event_deaths, stat_deaths)
        deaths = confirmed - self.accounted_deaths
        self.accounted_deaths = confirmed
        if self.previous_torches is None or torch_total < self.previous_torches:
            raise RuntimeError('缺失或回退的火把放置统计基线')
        placed = torch_total > self.previous_torches
        self.previous_torches = torch_total
        items = inventory_items(observation)
        equipment = observation.get('equipment', {})
        for name, quantity in zip(equipment.get('name', ()), equipment.get('quantity', ())):
            if quantity > 0 and item_id(name) not in {'air', 'none', ''}:
                items.add(item_id(name))
        return {'items': sorted(items), 'deaths': deaths, 'placed_torch': placed}
