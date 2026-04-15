export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { url } = req.body
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required' })
  }

  // Transform Google Docs/Sheets/Slides URLs to plain-text export
  let fetchUrl = url.trim()
  const gdocMatch = fetchUrl.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/)
  if (gdocMatch) {
    fetchUrl = `https://docs.google.com/document/d/${gdocMatch[1]}/export?format=txt`
  }

  try {
    const response = await fetch(fetchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Wren/1.0)',
        'Accept': 'text/plain,text/html,*/*',
      },
      redirect: 'follow',
    })

    if (!response.ok) {
      return res.status(400).json({
        error: `Could not fetch that URL (${response.status}). Make sure the document is set to "Anyone with the link can view".`,
      })
    }

    const contentType = response.headers.get('content-type') ?? ''
    let text = await response.text()

    // Strip HTML tags if the response is HTML
    if (contentType.includes('html')) {
      text = text
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\s{3,}/g, '\n\n')
        .trim()
    }

    if (!text || text.length < 50) {
      return res.status(400).json({ error: 'No readable content found at that URL.' })
    }

    return res.status(200).json({ text: text.slice(0, 50000) })
  } catch (err) {
    console.error('fetch-url error:', err)
    return res.status(500).json({ error: 'Could not reach that URL. Check the address and try again.' })
  }
}
