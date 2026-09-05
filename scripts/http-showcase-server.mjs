import { createServer } from 'node:http'
import process from 'node:process'

// Synthetic, in-memory API for documentation screenshots. No external services.
const products = [
  {
    id: 'prd_weekender',
    name: 'Canvas Weekender',
    category: 'bags',
    price: 89,
    currency: 'USD',
    stock: 42,
  },
  {
    id: 'prd_bottle',
    name: 'Trail Bottle',
    category: 'accessories',
    price: 24,
    currency: 'USD',
    stock: 128,
  },
  {
    id: 'prd_tote',
    name: 'Everyday Tote',
    category: 'bags',
    price: 36,
    currency: 'USD',
    stock: 67,
  },
]
const customers = [
  {
    id: 'cus_2048',
    name: 'Alex Morgan',
    email: 'alex@example.test',
    orders: 8,
    lifetimeValue: 642,
    currency: 'USD',
  },
  {
    id: 'cus_2049',
    name: 'Sam Rivera',
    email: 'sam@example.test',
    orders: 3,
    lifetimeValue: 218,
    currency: 'USD',
  },
]
const orders = new Map()
orders.set('ord_1042', {
  id: 'ord_1042',
  number: 'NS-1042',
  status: 'paid',
  currency: 'USD',
  customer: customers[0],
  items: [
    {
      productId: 'prd_weekender',
      name: 'Canvas Weekender',
      quantity: 1,
      unitPrice: 89,
    },
  ],
  subtotal: 89,
  shipping: 5,
  total: 94,
  createdAt: '2026-09-05T09:15:00Z',
})
let sequence = 1042
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:5190')
  const send = (status, data) => {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'X-Request-Id': 'req_demo_8f24a1',
      'X-RateLimit-Remaining': '998',
      'Cache-Control': 'no-store',
    })
    res.end(JSON.stringify(data, null, 2))
  }
  let text = ''
  for await (const chunk of req) {
    text += chunk
    if (text.length > 65536) {
      send(413, { error: 'payload_too_large' })
      return
    }
  }
  let body
  try {
    body = text ? JSON.parse(text) : {}
  }
  catch {
    send(400, { error: 'invalid_json', message: 'Request body must be JSON.' })
    return
  }
  const p = url.pathname.replace(/^\/v1/, '')
  if (p === '/health') {
    send(200, {
      status: 'healthy',
      version: '2.8.0',
      region: 'eu-west-1',
      uptime: 86400,
      checks: { database: 'healthy', cache: 'healthy', queue: 'healthy' },
    })
    return
  }
  if (p === '/metrics') {
    send(200, {
      window: '24h',
      requests: 128430,
      errorRate: 0.002,
      latency: { p50: 42, p95: 126, p99: 248 },
      ordersCreated: 284,
      revenue: { amount: 26418, currency: 'USD' },
    })
    return
  }
  if (p === '/status/maintenance') {
    send(503, {
      error: 'maintenance',
      message: 'Scheduled maintenance in progress.',
      retryAfterSeconds: 60,
    })
    return
  }
  if (p === '/auth/token' && req.method === 'POST') {
    send(200, {
      token: 'demo-commerce-token',
      expiresIn: 3600,
      user: { id: 'usr_demo', name: 'Alex Morgan', role: 'developer' },
    })
    return
  }
  if (req.headers.authorization !== 'Bearer demo-commerce-token') {
    send(401, {
      error: 'unauthorized',
      message: 'Use the Commerce · Local demo environment.',
    })
    return
  }
  if (p === '/products') {
    const category = url.searchParams.get('category')
    const data = products.filter(
      item => !category || item.category === category,
    )
    send(200, { data, pagination: { page: 1, limit: 20, total: data.length } })
    return
  }
  if (p.startsWith('/products/')) {
    const product = products.find(item => item.id === p.split('/')[2])
    send(product ? 200 : 404, product ?? { error: 'product_not_found' })
    return
  }
  if (p === '/customers') {
    send(200, {
      data: customers,
      pagination: { page: 1, total: customers.length },
    })
    return
  }
  if (p.startsWith('/customers/')) {
    const customer = customers.find(item => item.id === p.split('/')[2])
    send(customer ? 200 : 404, customer ?? { error: 'customer_not_found' })
    return
  }
  if (p === '/orders' && req.method === 'POST') {
    const customer = customers.find(item => item.id === body.customerId)
    const item = body.items?.[0]
    const product = products.find(product => product.id === item?.productId)
    if (
      !customer
      || !product
      || !Number.isInteger(item.quantity)
      || item.quantity < 1
    ) {
      send(422, {
        error: 'validation_failed',
        fields: {
          items: 'Provide an existing product and a positive quantity.',
        },
      })
      return
    }
    sequence += 1
    const order = {
      id: `ord_${sequence}`,
      number: `NS-${sequence}`,
      status: 'paid',
      currency: 'USD',
      customer,
      items: [
        {
          productId: product.id,
          name: product.name,
          quantity: item.quantity,
          unitPrice: product.price,
        },
      ],
      subtotal: product.price * item.quantity,
      shipping: 5,
      total: product.price * item.quantity + 5,
      createdAt: '2026-09-05T09:30:00Z',
    }
    orders.set(order.id, order)
    send(201, order)
    return
  }
  if (p === '/orders') {
    send(200, {
      data: [...orders.values()],
      pagination: { page: 1, total: orders.size },
    })
    return
  }
  if (p.startsWith('/orders/')) {
    const order = orders.get(p.split('/')[2])
    if (!order) {
      send(404, { error: 'order_not_found' })
      return
    }
    if (p.endsWith('/fulfillment') && req.method === 'POST') {
      order.status = 'shipped'
      order.fulfillment = {
        carrier: 'Northstar Delivery',
        trackingNumber: 'NS-DEMO-2048',
        estimatedDelivery: '2026-09-08',
      }
    }
    send(200, order)
    return
  }
  send(404, { error: 'not_found' })
})
server.on('error', (error) => {
  console.error(error.code)
  process.exitCode = 1
})
server.listen(5190, '127.0.0.1', () =>
  console.info('HTTP showcase API: http://127.0.0.1:5190/v1'))
