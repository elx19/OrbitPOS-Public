const { getDb } = require('../database');

function fetchActiveDiscounts(referenceDate = new Date()) {
  const dateText = referenceDate.toISOString().slice(0, 10);
  return getDb().prepare(`
    SELECT *
    FROM discounts
    WHERE active = 1
      AND (start_date IS NULL OR start_date = '' OR start_date <= ?)
      AND (end_date IS NULL OR end_date = '' OR end_date >= ?)
    ORDER BY created_at ASC, id ASC
  `).all(dateText, dateText);
}

function getLineKey(line, index) {
  return `${line.product.id}:${index}`;
}

function matchesDiscount(discount, line, customerId) {
  const appliesTo = String(discount.applies_to || 'all').toLowerCase();
  const targetValue = discount.target_id;

  if (appliesTo === 'all') {
    return true;
  }
  if (appliesTo === 'product') {
    return Number(targetValue) === Number(line.product.id);
  }
  if (appliesTo === 'category') {
    return String(targetValue || '').toLowerCase() === String(line.product.category || '').toLowerCase();
  }
  if (appliesTo === 'customer') {
    return Number(targetValue) === Number(customerId || 0);
  }

  return false;
}

function evaluateAutomaticDiscounts(lines, customerId) {
  const discounts = fetchActiveDiscounts();
  const lineDiscounts = new Map();
  const cartDiscounts = [];
  const details = [];

  lines.forEach((line, index) => {
    lineDiscounts.set(line.lineKey || getLineKey(line, index), 0);
  });

  discounts.forEach((discount) => {
    const eligibleLines = lines.filter((line) => matchesDiscount(discount, line, customerId));
    if (!eligibleLines.length) {
      return;
    }

    const type = String(discount.type || '').toLowerCase();
    const value = Number(discount.value || 0);
    let appliedAmount = 0;

    if (type === 'percentage') {
      eligibleLines.forEach((line, index) => {
        const amount = Number(((line.unitPrice * line.quantity) * (value / 100)).toFixed(2));
        const lineKey = line.lineKey || getLineKey(line, index);
        lineDiscounts.set(lineKey, Number((lineDiscounts.get(lineKey) + amount).toFixed(2)));
        appliedAmount += amount;
      });
    } else if (type === 'fixed') {
      const appliesTo = String(discount.applies_to || 'all').toLowerCase();
      if (appliesTo === 'all' || appliesTo === 'customer') {
        cartDiscounts.push({
          discountId: discount.id,
          name: discount.name,
          type,
          amount: value,
          lineKeys: eligibleLines.map((line, index) => line.lineKey || getLineKey(line, index))
        });
        appliedAmount = value;
      } else {
        eligibleLines.forEach((line, index) => {
          const lineKey = line.lineKey || getLineKey(line, index);
          lineDiscounts.set(lineKey, Number((lineDiscounts.get(lineKey) + value).toFixed(2)));
          appliedAmount += value;
        });
      }
    } else if (type === '2x1') {
      eligibleLines.forEach((line, index) => {
        const freeUnits = Math.floor(Number(line.quantity || 0) / 2);
        if (freeUnits <= 0) {
          return;
        }
        const amount = Number((freeUnits * line.unitPrice).toFixed(2));
        const lineKey = line.lineKey || getLineKey(line, index);
        lineDiscounts.set(lineKey, Number((lineDiscounts.get(lineKey) + amount).toFixed(2)));
        appliedAmount += amount;
      });
    }

    if (appliedAmount > 0) {
      details.push({
        id: discount.id,
        name: discount.name,
        type,
        amount: Number(appliedAmount.toFixed(2)),
        appliesTo: discount.applies_to
      });
    }
  });

  return {
    lineDiscounts,
    cartDiscounts,
    details
  };
}

module.exports = {
  evaluateAutomaticDiscounts,
  fetchActiveDiscounts,
  getLineKey
};
