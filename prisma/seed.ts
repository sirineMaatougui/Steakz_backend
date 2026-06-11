import {
  PrismaClient,
  Role,
  OrderType,
  OrderStatus,
  PaymentMethod,
  DeliveryStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const STAFF_PASSWORD = 'Steakz@123';
const CUSTOMER_PASSWORD = 'Customer@123';
const ROUNDS = 12;

async function hash(pw: string): Promise<string> {
  return bcrypt.hash(pw, ROUNDS);
}

interface MenuSeed {
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
}

// 12 items per branch — the 6 with bespoke photos, plus 6 more (images reused / fall back gracefully).
const MENU: MenuSeed[] = [
  { name: 'Dry-Aged Ribeye', description: '28-day dry-aged ribeye, herb butter, roasted garlic.', price: 32.0, category: 'Steaks', image: 'ribeye.jpg' },
  { name: 'Filet Mignon', description: 'Tender beef tenderloin, red wine peppercorn sauce, truffle mash.', price: 36.5, category: 'Steaks', image: 'filet-mignon.jpg' },
  { name: 'Steakz Signature Burger', description: 'Aged cheddar, caramelised onion, brioche, hand-cut fries.', price: 16.0, category: 'Burgers', image: 'burger.jpg' },
  { name: 'Garlic Butter King Prawns', description: 'Charred jumbo prawns, garlic herb butter, lemon.', price: 14.5, category: 'Seafood', image: 'prawns.jpg' },
  { name: 'Truffle Parmesan Fries', description: 'Hand-cut fries, truffle oil, parmesan, aioli.', price: 7.5, category: 'Sides', image: 'truffle-fries.jpg' },
  { name: 'Molten Chocolate Cake', description: 'Gooey chocolate fondant, vanilla bean ice cream, raspberries.', price: 8.5, category: 'Desserts', image: 'lava-cake.jpg' },
  { name: 'Sirloin Steak', description: 'Grass-fed sirloin, chimichurri, triple-cooked chips.', price: 26.0, category: 'Steaks', image: 'sirloin.jpg' },
  { name: 'BBQ Beef Short Ribs', description: 'Slow-braised short ribs, bourbon BBQ glaze, slaw.', price: 23.0, category: 'Grill', image: 'bbq-ribs.jpg' },
  { name: 'Caesar Salad', description: 'Cos lettuce, parmesan, sourdough croutons, anchovy dressing.', price: 9.5, category: 'Starters', image: 'caesar-salad.jpg' },
  { name: 'Crispy Onion Rings', description: 'Beer-battered onion rings, smoked paprika mayo.', price: 6.0, category: 'Sides', image: 'onion-rings.jpg' },
  { name: 'New York Cheesecake', description: 'Baked vanilla cheesecake, berry compote.', price: 7.5, category: 'Desserts', image: 'cheesecake.jpg' },
  { name: 'House Red Wine', description: 'Glass of our Malbec house red.', price: 6.5, category: 'Drinks', image: 'red-wine.jpg' },
];

// Each branch gets several delivery drivers so auto-assignment can rotate between them.
const DRIVER_NAMES: string[] = ['Sam Reid', 'Alex Cole', 'Jo Patel'];

interface BranchSeed {
  name: string;
  address: string;
  phone: string;
  slug: string;
}

const BRANCHES: BranchSeed[] = [
  { name: 'Manchester', address: '12 Spinningfields, Manchester M3 3EB', phone: '+44 161 555 0101', slug: 'manchester' },
  { name: 'Leeds', address: '8 Greek Street, Leeds LS1 5RW', phone: '+44 113 555 0202', slug: 'leeds' },
];

async function upsertUser(email: string, name: string, role: Role, password: string, branchId: number | null) {
  return prisma.user.upsert({
    where: { email },
    update: { name, role, branchId },
    create: { email, name, role, branchId, password: await hash(password) },
  });
}

type MenuItemRow = { id: number; name: string; price: number };

/** A compact spec for a sample order, expanded into real rows below. */
interface OrderSpec {
  type: OrderType;
  status: OrderStatus;
  by: 'waiter' | number; // 'waiter' (dine-in/floor) or an index into the customers array
  lines: [number, number][]; // [menuIndex, quantity]
  pay?: PaymentMethod; // present → a Payment row is created (counts as revenue)
  delivery?: DeliveryStatus; // present → a Delivery row is created
}

// A realistic day across the operational roles — same shape for every branch.
const ORDER_SPECS: OrderSpec[] = [
  { type: OrderType.DINE_IN, status: OrderStatus.PAID, by: 'waiter', lines: [[0, 2], [4, 1]], pay: PaymentMethod.CARD },
  { type: OrderType.DINE_IN, status: OrderStatus.PAID, by: 'waiter', lines: [[6, 1], [7, 2], [9, 1]], pay: PaymentMethod.CASH },
  { type: OrderType.TAKEAWAY, status: OrderStatus.PAID, by: 0, lines: [[2, 1], [4, 1], [5, 1]], pay: PaymentMethod.CARD },
  { type: OrderType.DELIVERY, status: OrderStatus.DELIVERED, by: 1, lines: [[1, 1], [3, 1], [10, 1]], pay: PaymentMethod.CARD, delivery: DeliveryStatus.DELIVERED },
  { type: OrderType.DINE_IN, status: OrderStatus.SERVED, by: 'waiter', lines: [[0, 1], [8, 1]] }, // cashier: to charge
  { type: OrderType.TAKEAWAY, status: OrderStatus.SERVED, by: 2, lines: [[2, 2], [9, 1]] }, // cashier: to charge
  { type: OrderType.DINE_IN, status: OrderStatus.READY, by: 'waiter', lines: [[1, 1], [4, 1]] }, // waiter: to serve
  { type: OrderType.DINE_IN, status: OrderStatus.PREPARING, by: 'waiter', lines: [[6, 2]] }, // kitchen: mark ready
  { type: OrderType.TAKEAWAY, status: OrderStatus.PENDING, by: 3, lines: [[5, 2], [10, 1]] }, // kitchen: start
  { type: OrderType.DELIVERY, status: OrderStatus.OUT_FOR_DELIVERY, by: 0, lines: [[2, 1], [3, 1]], delivery: DeliveryStatus.OUT_FOR_DELIVERY }, // driver: mark delivered
  { type: OrderType.DELIVERY, status: OrderStatus.PREPARING, by: 4, lines: [[7, 1], [4, 2]], delivery: DeliveryStatus.ASSIGNED }, // driver: out for delivery
  { type: OrderType.TAKEAWAY, status: OrderStatus.CANCELLED, by: 1, lines: [[5, 1]] }, // cancelled example
];

async function main(): Promise<void> {
  console.log('🌱 Seeding Steakz MIS...');

  // 1. Global users — admin (from env) + HQ manager.
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@steakz.co.uk';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'Admin@12345';
  const adminName = process.env.ADMIN_NAME ?? 'System Administrator';

  await upsertUser(adminEmail, adminName, Role.ADMIN, adminPassword, null);
  await upsertUser('hq@steakz.co.uk', 'Harriet Quinn (HQ)', Role.HQ_MANAGER, STAFF_PASSWORD, null);

  // 2. Customers (global self-service).
  const customers = await Promise.all([
    upsertUser('alice@example.com', 'Alice Walker', Role.CUSTOMER, CUSTOMER_PASSWORD, null),
    upsertUser('bob@example.com', 'Bob Stone', Role.CUSTOMER, CUSTOMER_PASSWORD, null),
    upsertUser('carol@example.com', 'Carol Diaz', Role.CUSTOMER, CUSTOMER_PASSWORD, null),
    upsertUser('dan@example.com', 'Dan Murphy', Role.CUSTOMER, CUSTOMER_PASSWORD, null),
    upsertUser('eve@example.com', 'Eve Bennett', Role.CUSTOMER, CUSTOMER_PASSWORD, null),
  ]);

  // 3. Reset demo orders so re-seeding gives a known, rich state (cascades to items/payments/deliveries).
  await prisma.order.deleteMany({});

  // 4. Per-branch: branch + full staff set + menu + the sample-day orders.
  for (const b of BRANCHES) {
    const branch = await prisma.branch.upsert({
      where: { name: b.name },
      update: { address: b.address, phone: b.phone },
      create: { name: b.name, address: b.address, phone: b.phone },
    });

    await upsertUser(`manager.${b.slug}@steakz.co.uk`, `${b.name} Manager`, Role.BRANCH_MANAGER, STAFF_PASSWORD, branch.id);
    const chef = await upsertUser(`chef.${b.slug}@steakz.co.uk`, `${b.name} Head Chef`, Role.CHEF, STAFF_PASSWORD, branch.id);
    const cashier = await upsertUser(`cashier.${b.slug}@steakz.co.uk`, `${b.name} Cashier`, Role.CASHIER, STAFF_PASSWORD, branch.id);
    const waiter = await upsertUser(`waiter.${b.slug}@steakz.co.uk`, `${b.name} Waiter`, Role.WAITER, STAFF_PASSWORD, branch.id);
    // Several drivers per branch so auto-assignment has someone to rotate to.
    const drivers = await Promise.all(
      DRIVER_NAMES.map((n, i) =>
        upsertUser(
          `driver${i === 0 ? '' : i + 1}.${b.slug}@steakz.co.uk`,
          `${n} (${b.name})`,
          Role.DELIVERY,
          STAFF_PASSWORD,
          branch.id,
        ),
      ),
    );
    void chef;

    // Menu items for this branch.
    const items: MenuItemRow[] = await Promise.all(
      MENU.map((m) =>
        prisma.menuItem.upsert({
          where: { branchId_name: { branchId: branch.id, name: m.name } },
          update: { description: m.description, price: m.price, category: m.category, image: m.image, available: true },
          create: { ...m, branchId: branch.id },
          select: { id: true, name: true, price: true },
        }),
      ),
    );

    // Expand each spec into a real order (+ payment / delivery where applicable).
    let deliveryIdx = 0; // round-robin delivery orders across the branch's drivers
    for (const spec of ORDER_SPECS) {
      const total = Math.round(spec.lines.reduce((s, [idx, qty]) => s + items[idx].price * qty, 0) * 100) / 100;
      const assignedDriverId = spec.delivery ? drivers[deliveryIdx++ % drivers.length].id : null;
      await prisma.order.create({
        data: {
          branchId: branch.id,
          type: spec.type,
          status: spec.status,
          total,
          waiterId: spec.by === 'waiter' ? waiter.id : null,
          customerId: typeof spec.by === 'number' ? customers[spec.by].id : null,
          items: {
            create: spec.lines.map(([idx, qty]) => ({
              menuItemId: items[idx].id,
              name: items[idx].name,
              quantity: qty,
              unitPrice: items[idx].price,
            })),
          },
          payment: spec.pay ? { create: { cashierId: cashier.id, amount: total, method: spec.pay } } : undefined,
          delivery: spec.delivery
            ? {
                create: {
                  driverId: assignedDriverId,
                  address: `${typeof spec.by === 'number' ? customers[spec.by].name : 'Customer'}, 5 Oak Lane, ${b.name}`,
                  status: spec.delivery,
                  deliveredAt: spec.delivery === DeliveryStatus.DELIVERED ? new Date() : null,
                },
              }
            : undefined,
        },
      });
    }

    console.log(`  ✔ ${b.name}: ${4 + drivers.length} staff (incl. ${drivers.length} drivers) + ${items.length} menu items + ${ORDER_SPECS.length} orders`);
  }

  console.log('\n✅ Seed complete. Demo logins:');
  console.log(`  ADMIN           ${adminEmail}  (${adminPassword})`);
  console.log(`  HQ_MANAGER      hq@steakz.co.uk  (${STAFF_PASSWORD})`);
  console.log(`  CUSTOMER        alice@example.com … eve@example.com  (${CUSTOMER_PASSWORD})`);
  for (const b of BRANCHES) {
    console.log(`  ── ${b.name} (password ${STAFF_PASSWORD}) ──`);
    console.log(`     BRANCH_MANAGER  manager.${b.slug}@steakz.co.uk`);
    console.log(`     CHEF            chef.${b.slug}@steakz.co.uk`);
    console.log(`     CASHIER         cashier.${b.slug}@steakz.co.uk`);
    console.log(`     WAITER          waiter.${b.slug}@steakz.co.uk`);
    console.log(`     DELIVERY        driver.${b.slug}@steakz.co.uk · driver2.${b.slug}@… · driver3.${b.slug}@…`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
