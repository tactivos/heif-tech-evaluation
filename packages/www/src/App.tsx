import './App.css'
import { useState } from 'react'
import hrtime from 'browser-process-hrtime'
import bytes from "bytes"

type Maybe<T> = T | undefined | null
type FileInfo = {
  url: string,
  name: string,
  time?: string,
  size?: string,
}

const _formatHrTime = (delta: [number, number]) => `${(delta[0] / 1000) + (delta[1] / 1000000)} ms`

const convertWithMagickWasm = async (file: File) => {
  // const { initializeImageMagick, ImageMagick } = await import("@imagemagick/magick-wasm")
  // const { Magick } = await import("@imagemagick/magick-wasm/magick")
  // await initializeImageMagick()
  // console.log(Magick.features)
  // console.log(Magick.delegates)
  // console.log(Magick.imageMagickVersion)
}

const convertWithHeic2Any = async (file: File, ext: string = "jpeg"): Promise<FileInfo> => {
  const heic2any = await import("heic2any") as any
  const url = URL.createObjectURL(file)
  const blob = await fetch(url).then(res => res.blob())

  const startTime = hrtime()
  const result = await heic2any({ blob, toType: `image/${ext}` })
  const delta = hrtime(startTime)

  const resultUrl = URL.createObjectURL(result as Blob)
  const resultBlob = await fetch(resultUrl).then(res => res.blob())
  return {
    url: resultUrl,
    name: `local.heic2any.${ext}`,
    time: _formatHrTime(delta),
    size: bytes(resultBlob.size, { unit: 'kb', unitSeparator: ' ' })
  }

}

function App() {

  const [fileToConvert, setFileToConvert] = useState<Maybe<File>>(undefined)
  const [convertedFiles, setConvertedFiles] = useState<Array<FileInfo>>()
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e?.target?.files
    const file = files?.item(0)
    setFileToConvert(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (fileToConvert instanceof File) {
      const formData = new FormData()
      formData.append("image", fileToConvert)

      setIsLoading(true)

      let data = await fetch("http://localhost:3001/api/v1/convert", {
        method: 'POST',
        body: formData
      }).then(res => res.json()).catch((error) => {
        setIsLoading(false)
        console.error(error)
      })

      data = [
        ...data,
        await convertWithHeic2Any(fileToConvert),
        await convertWithHeic2Any(fileToConvert, "png"),
      ]

      setConvertedFiles(data)
      setIsLoading(false)

      // const Magick = await import('./lib//magickApi.js')
      // const url = URL.createObjectURL(fileToConvert)
      // const fileName = fileToConvert.name
      // console.log('start')
      // const inputFiles = [
      //     await Magick.buildInputFile(url, fileName)
      // ]
      // console.log({ inputFiles })
      // const { outputFiles, exitCode, stdout } = await Magick.execute({
      //   inputFiles,
      //   commands: [
      //     `identify -verbose ${fileName}`
      //   ]
      // })
      // console.log('end')
      // console.log({
      //   outputFiles,
      //   exitCode,
      //   stdout
      // })
      // const _getMimeTypeFromStdOut = (stdout: Array<string>) => {
      //   return stdout.find(v => v.includes("Mime type:"))?.split(": ")[1]
      // }

      // const mimeType = _getMimeTypeFromStdOut(stdout)

      // console.log({
      //   mimeType
      // })
    }
  }

  return (
    <div className="App">
      <header className="App__header">
        <h1>.HEIF Tech Evaluation</h1>
      </header>
      <aside className='App__aside'>
        <form className="FileUpload" onSubmit={handleSubmit}>
          <label className="FileUpload__label">
            <span className="FileUpload__label__text">Upload file</span>
            <input className="FileUpload__label__input" type="file" name="" id="" onChange={handleFileChange} />
          </label>
          <button className="FileUpload__submit" type="submit" disabled={!fileToConvert || isLoading}>
            { isLoading ? 'Converting...' : 'Convert' }
          </button>
        </form>
        {
          fileToConvert && (
            <div className="FileToConvertInfo">
              <h2>File to Convert:</h2>
              <p>Name: {fileToConvert.name}</p>
              <p>Type: {fileToConvert.type}</p>
              <p>Size: {bytes(fileToConvert.size, { unit: "kb", decimalPlaces: 4 })}</p>
            </div>
          )
        }
        {
          <div className="Payload">
            {
              isLoading ? (
                <>
                  <h2>Loading...</h2>
                  <p>This will take a while...</p>
                </>
              ) : (
                <pre>
                  <code>
                    {convertedFiles && JSON.stringify(convertedFiles, null, 2)}
                  </code>
                </pre>
              )
            }
          </div>
        }
      </aside>
      <main className="App__main">
        {
          isLoading && (
            <div>
              <h2>Loading...</h2>
              <p>This will take a while...</p>
            </div>
          )
        }
        {
          !isLoading && convertedFiles?.map(file => {
            const delta = file.size ? bytes(file?.size) - (fileToConvert?.size ?? 0) : 0
            const deltaPercentage = file.size ? delta / (fileToConvert?.size || 1) : 0
            const deltaFormatted = file.size ? bytes(
              delta,
              {
                unit: "kb",
                unitSeparator: " "
              }
            ) : "n/a"
            return (
        <div className="FileInfo" key={file.name}>
          <div className="FileInfo__name">
            <p>Name: {file.name}</p>
            <p>Time: {file.time}</p>
            <p>Size: {file?.size}</p>
            <p>Size Delta: { deltaFormatted } => { (deltaPercentage + 1).toFixed(4) }x larger than original</p>
          </div>
          <div className="FileInfo__img">
            <img src={file.url} alt="" />
          </div>
        </div>
        )
          })
        }
      </main>
      <footer className='App__footer'></footer>
    </div>
  )
}

export default App
