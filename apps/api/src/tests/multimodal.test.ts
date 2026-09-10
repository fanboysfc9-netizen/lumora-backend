import { attachmentSummary, MULTIMODAL_LIMITS, normalizeUpload, validateUpload } from '../services/multimodal.service'

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

function file(name: string, type: string, content: string | Buffer, size?: number) {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content)
  return { originalname: name, mimetype: type, size: size ?? buffer.length, buffer }
}

export async function run() {
  const text = await normalizeUpload(file('lesson.txt', 'text/plain', 'Solve 2x + 7 = 19.'))
  assert(text.type === 'document' && text.extractedText?.includes('2x + 7'), 'TXT files must normalize to bounded readable text')
  assert(attachmentSummary(text).includes('lesson.txt'), 'Attachment summaries must contain safe metadata only')

  const image = await normalizeUpload(file('homework.png', 'image/png', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
  assert(image.type === 'image' && image.imageDataUrl?.startsWith('data:image/png;base64,'), 'Images must normalize to a provider-ready data URL')

  let malformedImage = false
  try { await normalizeUpload(file('broken.png', 'image/png', Buffer.from([1, 2, 3]))) } catch (error) { malformedImage = (error as Error).message === 'That image could not be read.' }
  assert(malformedImage, 'Malformed images must be rejected safely')

  let unsupported = false
  try { validateUpload(file('script.exe', 'application/octet-stream', 'bad')) } catch (error) { unsupported = (error as Error).message === "That file type is not supported." }
  assert(unsupported, 'Unsupported MIME types must be rejected safely')

  let oversized = false
  try { validateUpload(file('large.png', 'image/png', 'x', MULTIMODAL_LIMITS.maxBytes + 1)) } catch (error) { oversized = (error as Error).message === 'That file is too large to process.' }
  assert(oversized, 'Oversized uploads must be rejected safely')

  let malformed = false
  try { await normalizeUpload(file('broken.pdf', 'application/pdf', 'not a pdf')) } catch (error) { malformed = (error as Error).message !== 'not a pdf' }
  assert(malformed, 'Malformed PDFs must fail without exposing parser internals')

  let empty = false
  try { await normalizeUpload(file('empty.txt', 'text/plain', '   ')) } catch (error) { empty = (error as Error).message === 'That document does not contain readable text.' }
  assert(empty, 'Empty documents must be rejected safely')

  console.log('[PASS] multimodal upload and normalization contracts')
}

if (require.main === module) run().catch((error) => { console.error(error); process.exitCode = 1 })