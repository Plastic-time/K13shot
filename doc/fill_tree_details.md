### src/4-fill_tree_details.js 代码逻辑附文

`each_fill_details(data_unit_id)` 该函数将发起 details 请求，并返回必要信息：`{ data_unit_id, br, rp, sp, main_role }`

变量 `country_code` 表示国家字典值：

> ["usa", "germany", "ussr", "britain", "japan", "china", "italy", "france", "sweden", "israel"]

变量 `vehicle_type` 表示军种字典值：

> ["ground", "aviation", "helicopters",  "ships",  "boats"]



遍历完成对所有国家、所有军种的 tree_data 获取并注入 details 信息：

```js
for (let i = 0; i < country_code.length; i++) {
  for (let j = 0; j < vehicle_type.length; j++) {
    const tree_data = await get_tree_data(i, j);
    // 详见下方解释
  }
}
```

创建一个异步请求队列，遍历 tree_data，其下每个 type 为"single"的 item 作为一次 details 请求，将其加入异步请求队列。
队列中同时并发 `N(变量limit)` 个请求，当某个请求完成时，立即将下一个 item 加入，异步队列可以且必须同时处理 `N(变量limit)` 个请求，直到把 tree_data 中所有的 type 为"single"的 item 都请求完毕。

异步请求队列中只能同时存在同一个 `country_code` 和 `vehicle_type` 的数据，国家和军种需要一个个进行排队处理，避免出现竞态。当一个 details 请求完成时，`each_fill_details()` 的返回结果（格式）：

```js
return {
  data_unit_id, br, rp, sp, main_role
}
```


返回结果中的 `br, rp, sp, main_role` 逐一赋值到 tree_data 的对应 item 项中，随后该 item 下的 details 字段赋值为 true，表示当前item项已获取详情信息。

如果 `each_fill_details()` 函数中的 details 请求发生错误，会对其进行错误捕获。随后重新发起一次该 item 的 details 请求（再次调用 `each_fill_details()` 函数），一直递归直到请求成功，拿到 `data_unit_id, br, rp, sp, main_role` 必要信息为止。

------

当所有的 type 为"single"的 item 都成功完成了 details 请求之后，再一次遍历 tree_data，将其下 type 为"multiple"的 item 中的 details 赋值为 true。并且为其 br 字段赋值：

- type 为"multiple"的 item 中的 br 字段表示其下 items 中的 item 的 br 范围，示例：
  - items 下有三个 item，第一个br 是 9.0，第二个br 是 9.3，第三个br 是 9.7，该项"multiple"的 item 中的 br 就是"9.0-9.7"
  - 如果 items 下的 item br 都一样，例如都是9.0，那么 type 为"multiple"的 item 中的 br 就是"9.0"

------

处理完成后的 tree_data 将会写入本地文件 `根目录/database/<country_code>/<country_code>_<vehicle_type>.json`，例如：
`database/ussr/ussr_ground.json`。当所有国家所有军种的 json 数据都完成写入本地之后，整个 for 循环遍历将结束。

