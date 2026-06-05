import Module from 'module'
import path from 'path'

const originalResolveFilename = (Module as any)._resolveFilename
const coreRoot = path.resolve(__dirname, '..', '..', '..', 'core')

;(Module as any)._resolveFilename = function resolveCoreAlias(
  request: string,
  parent: NodeModule | null,
  isMain: boolean,
  options?: unknown
) {
  if (request === 'core' || request.startsWith('core/')) {
    const coreRequest = request === 'core' ? coreRoot : path.join(coreRoot, request.slice('core/'.length))
    return originalResolveFilename.call(this, coreRequest, parent, isMain, options)
  }

  return originalResolveFilename.call(this, request, parent, isMain, options)
}
