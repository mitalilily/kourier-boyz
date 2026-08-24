type FileTypeModule = typeof import('file-type')

const nativeImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string,
) => Promise<FileTypeModule>

let modulePromise: Promise<FileTypeModule> | undefined

export const detectFileType = async (buffer: Uint8Array) => {
  modulePromise ??= nativeImport('file-type')
  const { fileTypeFromBuffer } = await modulePromise
  return fileTypeFromBuffer(buffer)
}
