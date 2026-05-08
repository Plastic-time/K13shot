const unlock_quantity = {};

function get_unlock_quantity(t_c, type, rank) {
  return unlock_quantity[t_c]?.[type]?.[rank] ?? 0;
}

module.exports = { get_unlock_quantity };
