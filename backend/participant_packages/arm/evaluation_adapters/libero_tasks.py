"""Public LIBERO task catalogue; private initial states are supplied at runtime."""
# Task IDs refer to upstream's task_order_index=0, not a shuffled task order.
LIBERO_TASKS = [
    ("libero_spatial", 2, "pick_up_the_black_bowl_from_table_center_and_place_it_on_the_plate",
     "抓取放置：黑碗放到盘子", 600),
    ("libero_object", 0, "pick_up_the_alphabet_soup_and_place_it_in_the_basket",
     "物体操作：字母汤罐放入篮子", 600),
    ("libero_10", 0, "LIVING_ROOM_SCENE2_put_both_the_alphabet_soup_and_the_tomato_sauce_in_the_basket",
     "组合任务：两件物品放入篮子", 1000),
]


def libero_scenes(init_state_ids=(0, 1, 2), seeds=(42, 43, 44)):
    if len(init_state_ids) != 3 or len(seeds) != 3:
        raise ValueError("LIBERO needs three initial states and seeds")
    return [{"id": f"libero-{index + 1}", "label": label,
             "suite": suite, "task_id": task_id, "task_name": task_name,
             "init_state_id": state, "seed": seed, "max_steps": steps}
            for index, (state, seed, (suite, task_id, task_name, label, steps))
            in enumerate(zip(init_state_ids, seeds, LIBERO_TASKS))]
