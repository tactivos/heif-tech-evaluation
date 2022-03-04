import express from 'express'
import { nanoid } from 'nanoid'
import { execSync } from "child_process"
import cors from "cors"
import fileUpload from "express-fileupload"
import convert from 'heic-convert'
import fs from "fs/promises"
import path from 'path'
import bytes from 'bytes'

type RunCommandResult<T> = {
  data: T,
  meta: {
    name: string,
    path: string,
    url: string
    time: string,
    size: string
  }
}

type RunCommandCallbackOpts = {
  name: string,
  path: string,
  url: string
}

type RunCommandOpts<T> = {
  hash: string,
  callback: (meta: RunCommandCallbackOpts) => T,
  after?: (meta: RunCommandCallbackOpts, data?: T) => void | Promise<void>
  name: string,
  ext: string,
  uploadsDir: string
}

const _formatHrTime = (delta: [number, number]) => `${(delta[0] / 1000) + (delta[1] / 1000000)} ms`

async function runCommand<T>(opts: RunCommandOpts<T>): Promise<RunCommandResult<T>> {
  try {
    const filename = `${opts.hash}.${opts.name}.${opts.ext}`
    const uploadsPath = `${opts.uploadsDir}/${filename}`
    const staticUrl = `http://localhost:3001/uploads/${filename}`
    const startTime = process.hrtime()
    const meta = {
      name: filename,
      path: uploadsPath,
      url: staticUrl
    }
    const data = await opts.callback(meta)
    const delta = process.hrtime(startTime)
    const afterCallback = opts.after ?? function () { }
    await afterCallback(meta, data)
    const stats = await fs.stat(meta.path)
    const size = bytes(stats.size, { unit: "kb", unitSeparator: " " })
    return {
      data,
      meta: {
        time: _formatHrTime(delta),
        ...meta,
        size
      }
    }
  } catch (error) {
    console.error(error)
    throw error
  }
}

const app = express()

app.use(fileUpload({
  createParentPath: true,
}))
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
const uploadsDir = path.join(__dirname, "../uploads")
app.use('/uploads', express.static(uploadsDir))

app.post(`/api/v1/convert`, async (req, res) => {
  if (!req.files) {
    res.status(400).json({
      error: "File not provided"
    })
  } else {
    const image = req.files.image
    if (!Array.isArray(image)) {
      const hash = nanoid(4)

      // original

      const originalFile: RunCommandResult<Buffer> = await runCommand<Buffer>({
        hash,
        uploadsDir,
        name: 'original',
        ext: 'heif',
        callback: () => image.data,
        after: (meta) => image?.mv(meta.path)
      })

      // heic-convert - png

      const heicConvertPng: RunCommandResult<any> = await runCommand<any>({
        hash,
        uploadsDir,
        name: 'heic-convert',
        ext: 'png',
        callback: () => convert({
          buffer: originalFile.data,
          format: 'PNG'
        }),
        after: (meta, data) => fs.writeFile(meta.path, data)
      })

      // heic-convert - jpeg 

      const heicConvertJpeg: RunCommandResult<any> = await runCommand<any>({
        hash,
        uploadsDir,
        name: 'heic-convert',
        ext: 'jpeg',
        callback: () => convert({
          buffer: originalFile.data,
          format: 'JPEG'
        }),
        after: (meta, data) => fs.writeFile(meta.path, data)
      })

      // image magick - jpg

      const imageMagickJpg = await runCommand<any>({
        hash,
        uploadsDir,
        name: 'image-magick',
        ext: 'jpg',
        callback: (meta) => execSync(`convert ${originalFile.meta.path} ${meta.path}`)
      })

      // image magick - png

      const imageMagickPng = await runCommand<any>({
        hash,
        uploadsDir,
        name: 'image-magick',
        ext: 'png',
        callback: (meta) => execSync(`convert ${originalFile.meta.path} ${meta.path}`)
      })

      // heic-cli - png

      const heicCliPng = await runCommand<any>({
        hash,
        uploadsDir,
        name: 'heic-cli',
        ext: 'png',
        callback: meta => execSync(`yarn exec heic-cli < ${originalFile.meta.path} > ${meta.path}`)
      })

      // heic-cli - jpg 

      const heicCliJpg = await runCommand<any>({
        hash,
        uploadsDir,
        name: 'heic-cli',
        ext: 'jpg',
        callback: meta => execSync(`yarn exec heic-cli < ${originalFile.meta.path} > ${meta.path}`)
      })

      // response
      res.json([
        originalFile.meta,
        heicConvertPng.meta,
        heicConvertJpeg.meta,
        imageMagickPng.meta,
        imageMagickJpg.meta,
        heicCliPng.meta,
        heicCliJpg.meta,
      ])
    }
  }
})


app.listen("3001", () => {
  console.log("API Server running on port 3001")
})

