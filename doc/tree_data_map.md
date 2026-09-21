### tree_data 数据格式剖解附文(旧)

在tree_data中，一个对象表示一个等级，对应html中的div.wt-tree_rank.wt-tree_row。

- 其中researchable_vehicles的数据来源于style="grid-column: 1 / 3"的div下的table.wt-tree_rank-instance
  table.wt-tree_rank-instance是一个表格，其中一个tr表示一行

- 但researchable_vehicles的第一级表示列，因此researchable_vehicles中的第一个也就是第一列来源于table.wt-tree_rank-instance下每个tr：

  - 其实也就是把table的UI行结构转换到tree_data数组中的数据列结构

  - 第一列也就是每个tr中的第一个td下面的div.wt-tree_item，以此类推:


````js
<div class="wt-tree_item" data-unit-id="germ_garford_putilov"> （data-unit-id对应data_unit_id）
  <div class="wt-tree_item-icon" style="background-image:url('https://static.encyclopedia.warthunder.com/slots/germ_garford_putilov.png')" loading="lazy"></div>（background-image:url对应vehicle_icon）
  <div class="wt-tree_item-text"><span>Garford-Beute</span>（span对应title）</div><a class="wt-tree_item-link" href="/unit/germ_garford_putilov"></a>
</div>
````

div.wt-tree_item 对应为type: "single"

- 如果td下面不是div.wt-tree_item，而是div.wt-tree_group，则按照多载具来算，也就是type: "multiple":

````js
<div class="wt-tree_group" data-unit-id="germ_flakpanzer_1_group"> （data-unit-id对应data-unit-id，组合唯一标识）
  <div class="wt-tree_group-folder">
    <div class="wt-tree_group-folder_inner">
      <div class="wt-tree_item-icon" style="background-image:url('https://static.encyclopedia.warthunder.com/slots/germ_flakpanzer_1_group.png')" loading="lazy"></div>（background-image:url对应vehicle_icon，合标）
      <div class="wt-tree_item-text"><span>FlakPz I/38(t)</span>（span对应title，合称）</div>
    </div>
  </div>
  接下来就是子项：
  <div class="wt-tree_group-items"><canvas class="wt-tree_group-canvas"></canvas>
    <div class="wt-tree_item" data-unit-id="germ_flakpanzer_i_ausf_a">（data-unit-id对应data_unit_id）
      <div class="wt-tree_item-icon" style="background-image:url('https://static.encyclopedia.warthunder.com/slots/germ_flakpanzer_i_ausf_a.png')" loading="lazy"></div>（background-image:url对应vehicle_icon）
      <div class="wt-tree_item-text"><span>Flakpanzer&nbsp;I</span>（span对应title）</div><a class="wt-tree_item-link" href="/unit/germ_flakpanzer_i_ausf_a"></a>
    </div>
    <div class="wt-tree_item" data-unit-id="germ_flakpanzer_38t_gepard" data-unit-req="germ_flakpanzer_i_ausf_a">
      <div class="wt-tree_item-icon" style="background-image:url('https://static.encyclopedia.warthunder.com/slots/germ_flakpanzer_38t_gepard.png')" loading="lazy"></div>
      <div class="wt-tree_item-text"><span>Flakpanzer&nbsp;38</span></div><a class="wt-tree_item-link" href="/unit/germ_flakpanzer_38t_gepard"></a>
    </div>
  </div>
</div>
````
class_name字段统一空字符串，premium_vehicles的数据来源于style="grid-column: 4 / 6"的div下的table.wt-tree_rank-instance

- table.wt-tree_rank-instance是一个表格，其中一个tr表示一行
- 但researchable_vehicles的第一级表示列，因此researchable_vehicles中的第一个也就是第一列来源于table.wt-tree_rank-instance下每个tr：
  - 其实也就是把table的UI行结构转换到tree_data数组中的数据列结构
  - 第一列也就是每个tr中的第一个td下面的div.wt-tree_item，以此类推:
  - 这里跟researchable_vehicles的一样，但是有不同点：
    - 如果div.wt-tree_item同时存在类名.wt-tree_item--prem则表示为高级载具，那么class_name字段赋值为"prem"
      - 类名分为两种，div.wt-tree_item对应的是.wt-tree_item--prem
      - 而div.wt-tree_group对应的则是.wt-tree_group--prem
    - 如果div.wt-tree_item同时存在类名.wt-tree_item--squad则表示为联队载具，那么class_name字段赋值为"squad"
      - 同样分为.wt-tree_item--squad和.wt-tree_group--squad两种

- 通过请求https://wiki.warthunder.com/unit/拼接上data-unit-id获取单个载具的详细信息:
  - br来源于div.game-unit_br下的第二个div.game-unit_br-item下的div.value的innerText
  - rp来源于div.game-unit_header下的div.game-unit_card-info下的第三个div.game-unit_card-info_line:
    - 然后里面有两个div.game-unit_card-info_item：
      - 其中第一个里面的div.game-unit_card-info_value里面的第一个div的innerText就是rp
      - 第二个里面的div.game-unit_card-info_value里面的第一个div的innerText就是sp
  - 处于premium_vehicles字段下的item不需要rp和sp，直接赋值为0即可
- 基于数据已经初始化完成的tree_data进行遍历。
