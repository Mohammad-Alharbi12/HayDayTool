'use strict';

// A small, representative slice of the upstream data shape, used for offline
// unit tests. Includes a product name with trailing zero-width characters and
// an item with negative profit_per_hour — both real quirks of the live API.
module.exports = [
  { level: 1, machine: 'Crops', price: 1, product: 'Wheat', profit_per_hour: 6, time_min: 2, xp: 1, xp_per_hour: 30 },
  { level: 1, machine: 'Crops', price: 2, product: 'Corn', profit_per_hour: 12, time_min: 5, xp: 1, xp_per_hour: 12 },
  { level: 2, machine: 'Bakery', price: 20, product: 'Bread', profit_per_hour: 48, time_min: 5, xp: 3, xp_per_hour: 36 },
  { level: 7, machine: 'Bakery', price: 54, product: 'Corn bread', profit_per_hour: 40, time_min: 30, xp: 7, xp_per_hour: 14 },
  { level: 6, machine: 'Dairy', price: 79, product: 'Cheese', profit_per_hour: 90, time_min: 60, xp: 10, xp_per_hour: 10 },
  { level: 1, machine: 'Animal Products', price: 8, product: 'Egg', profit_per_hour: 20, time_min: 20, xp: 0, xp_per_hour: 0 },
  { level: 6, machine: 'Animal Products', price: 24, product: 'Milk', profit_per_hour: 30, time_min: 60, xp: 1, xp_per_hour: 1 },
  { level: 2, machine: 'Trees & Bushes', price: 15, product: 'Apple', profit_per_hour: -5, time_min: 1440, xp: 2, xp_per_hour: 0.08 },
  { level: 45, machine: 'Bakery', price: 403, product: 'Frutti di Mare pizza​​', profit_per_hour: 94.1, time_min: 12, xp: 48, xp_per_hour: 225.8 },
];
