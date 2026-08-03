const url = 'http://127.0.0.1:5000/api/v1/t/vasant-trailers/kb/copilot/complete'
const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  },
  body: JSON.stringify({
    content: 'hi',
    stream: true,
    context: { routePath: '/crm' },
  }),
})
const text = await res.text()
console.log(JSON.stringify({ status: res.status, body: text.slice(0, 500) }))
