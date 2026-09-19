// Planning functions from commit 492cc61, retained only for regression comparison.
function shouldIgnoreRequirement(unit, reqId) {
  if (!unit || !reqId) return false;
  if (isFirstRankValue(unit.rank)) return true;

  const requiredItem = getIndexedItem(reqId);
  return requiredItem ? isFirstRankValue(requiredItem.rank) : false;
}

function flattenTree(tree) {
  const units = [];
  const groups = [];
  const previousByColumn = {
    researchable: [],
    premium: [],
  };
  let rankIndex = 0;

  for (const rank of tree) {
    if (rankIndex === 1) previousByColumn.researchable = [];

    for (const section of ["researchable_vehicles", "premium_vehicles"]) {
      const sectionType = section === "premium_vehicles" ? "premium" : "researchable";
      const columns = rank[section] || [];
      columns.forEach((column, columnIndex) => {
        let previousDependencyId = previousByColumn[sectionType][columnIndex] || "";
        column.forEach((item, rowIndex) => {
          const inferredReqId = sectionType === "researchable" ? previousDependencyId : "";
          if (item.type === "multiple") {
            const groupReqId = item.required_unit_id || inferredReqId;
            const groupMainChildId = getGroupMainChildId(item);
            const squadronGroup = isSquadronUnit(item);
            const group = {
              ...item,
              is_squadron: squadronGroup,
              required_unit_id: groupReqId,
              rank: rank.rank,
              section: sectionType,
              columnIndex,
              rowIndex,
            };
            groups.push(group);
            (item.items || []).forEach((subItem, subIndex) => {
              const subReqId = subItem.required_unit_id || groupReqId;
              units.push({
                ...subItem,
                class_name: subItem.class_name || (squadronGroup ? "squad" : ""),
                is_squadron: squadronGroup || subItem.is_squadron === true,
                rp: squadronGroup ? 0 : subItem.rp,
                sp: squadronGroup ? 0 : subItem.sp,
                required_unit_id: subReqId,
                rank: rank.rank,
                section: sectionType,
                parent_group_id: item.data_unit_id,
                parent_group_title: item.title,
                parent_required_unit_id: groupReqId,
                columnIndex,
                rowIndex: rowIndex + subIndex / 10,
              });
            });
            if (sectionType === "researchable") {
              previousDependencyId = groupMainChildId || item.data_unit_id || previousDependencyId;
              previousByColumn[sectionType][columnIndex] = previousDependencyId;
            }
          } else if (item.type === "single") {
            const reqId = item.required_unit_id || inferredReqId;
            const squadron = isSquadronUnit(item);
            units.push({
              ...item,
              is_squadron: squadron,
              rp: squadron ? 0 : item.rp,
              sp: squadron ? 0 : item.sp,
              required_unit_id: reqId,
              rank: rank.rank,
              section: sectionType,
              columnIndex,
              rowIndex,
            });
            if (sectionType === "researchable") {
              previousDependencyId = item.data_unit_id || previousDependencyId;
              previousByColumn[sectionType][columnIndex] = previousDependencyId;
            }
          }
        });
      });
    }
    rankIndex += 1;
  }

  state.units = units;
  state.groups = groups;
  state.unitMap = new Map(units.map((unit) => [unit.data_unit_id, unit]));
  state.groupMap = new Map(groups.map((group) => [group.data_unit_id, group]));
  state.initialUnlocked = new Set(units.filter(isInitialUnlockedUnit).map((unit) => unit.data_unit_id));
  state.initialUnlocked.forEach((id) => state.planned.delete(id));
}

function getDependencyIds(unitId, visited = new Set()) {
  if (!unitId || visited.has(unitId)) return [];
  visited.add(unitId);

  const unit = state.unitMap.get(unitId);
  if (!unit) {
    const group = state.groupMap.get(unitId);
    if (group) {
      const mainChildId = getGroupMainChildId(group);
      if (mainChildId && mainChildId !== unitId) return getDependencyIds(mainChildId, visited);
      return getDependencyIds(group.required_unit_id, visited);
    }

    return [];
  }

  const parentReq = unit.parent_required_unit_id && !unit.required_unit_id ? unit.parent_required_unit_id : "";
  const reqId = unit.required_unit_id || parentReq;
  const dependencyIds = shouldIgnoreRequirement(unit, reqId) ? [] : getDependencyIds(reqId, visited);
  return [...dependencyIds, unitId];
}
