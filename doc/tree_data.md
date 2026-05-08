### tree_data数据格式示例

```js
const tree_data = [
  {
    rank: "VII", // 当前等级（ranks的下标）
    researchable_vehicles: [
      // 普通载具
      [ // 第一列
        // 第一个item
        {
          type: "single", // item类型：single表示单个载具，multiple表示多个载具（也就是一个item里可展开多个载具）
          title: "Garford-Beute", // 载具名称
          vehicle_icon:
            "https://static.encyclopedia.warthunder.com/slots/germ_garford_putilov.png", // 载具图标
          br: null, // 载具权重，默认为空
          rp: -1, // 研发该载具所需研发点，为0时表示该载具无需研发，为-1时表示数据未获取（因为需要通过点击去请求详情才能更新到这里），默认为-1
          sp: 0, // 购买该载具所需银狮，为0时表示该载具无需用银狮购买，为1时表示数据未获取（同上），默认为-1
          data_unit_id: "germ_garford_putilov", // 载具唯一标识
          selected: false, // 载具当前选中状态，默认为false
          class_name: "", // 当前载具的class标识（用于区分普通载具/联队载具/高级载具的底色）squad表示联队，prem表示高级，普通则为空字符串
          main_role: "SPAA", // 当前载具的主要角色，如自行防空炮"SPAA"或者战斗机"Fighter"...
          details: false, // 当前载具是否已获取详情
        },
      ],
      [ // 第二列
        // 第一个
        {
          type: "multiple",
          title: "Garford-Beute-1/2", // 载具名称（合称）
          vehicle_icon: "...", // 载具图标（合标）
          selected: false, // 当前item下的载具已选中数量>=1时为true，默认为false
          br: "", // 载具权重，默认为空字符串，这里的权重是显示当前item下的载具权重范围，比如当前item下有一个9.3和一个9.7载具时，这里显示为'9.3-9.7', 如果当前item下载具权重都一样，那么一样显示为字符串型，例如: '9.3'
          data_unit_id: "il_magach_6a_5_group", // 组合唯一标识
          class_name: "", // 当前组合的class标识
          details: false, // 当前组合是否已获取详情（br）
          items: [
            /** ...若干个type为"single"的item */
          ],
        },
      ],
    ],
    premium_vehicles: [
      // 高级载具
      // 详见researchable_vehicles
    ],
    selected: [
      { data_unit_id, rp, sp },
      { data_unit_id, rp, sp },
    ], // 当前等级下已选中的载具（包括researchable_vehicles和premium_vehicles
    unlock_quantity: 6, // 当前等级下需要选中的载具数量，达成这个数量后才能选择下一级载具，如果当前已经是最后一级，这里将为0
  },
];
```