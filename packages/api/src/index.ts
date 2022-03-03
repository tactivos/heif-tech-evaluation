import express from 'express'
import cors from "cors"
import fileUpload from "express-fileupload"
import { nanoid } from 'nanoid'
import convert from 'heic-convert'
import fs from "fs/promises"
import { execSync } from "child_process"
import path from 'path'

const app = express()

app.use(fileUpload({
  createParentPath: true,
}))
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
const uploadsPath = path.join(__dirname, "../uploads")
app.use('/uploads', express.static(uploadsPath))

const FileInfo = (hash: string) => (name: string, ext: string = "png") => ({
  name: `${hash}.${name}.${ext}`,
  path: `${uploadsPath}/${hash}.${name}.${ext}`,
  url: `http://localhost:3001/uploads/${hash}.${name}.${ext}`
})

app.post(`/api/v1/convert`, async (req, res) => {
  if (!req.files) {
    res.status(400).json({
      error: "File not provided"
    })
  } else {
    const image = req.files.image
    if (!Array.isArray(image)) {
      const hash = nanoid(4)
      const getFileInfo = FileInfo(hash)
      const originalFileInfo = getFileInfo('original', 'heif')
      await image?.mv(originalFileInfo.path)
      const inputBuffer = image.data

      const getFormattedTime = (data: [number, number]) => {
        return `${data[0]}s ${data[1] / 1000000}ms`
      }

      // heic-convert - png
      const heicConvertTimerStart = process.hrtime()
      const heicConvertOutput = await convert({
        buffer: inputBuffer,
        format: 'PNG'
      })
      const heicConvertTimerEnd = process.hrtime(heicConvertTimerStart)
      const heicConvertInfo = getFileInfo("heic-convert")
      await fs.writeFile(heicConvertInfo.path, heicConvertOutput)
      
      // heic-convert - jpeg
      const heicConvertJpegTimerStart = process.hrtime()
      const heicConvertJpegOutput = await convert({
        buffer: inputBuffer,
        format: 'JPEG'
      })
      const heicConvertJpegTimerEnd = process.hrtime(heicConvertJpegTimerStart)
      const heicConvertJpegInfo = getFileInfo("heic-convert", "jpg")
      await fs.writeFile(heicConvertJpegInfo.path, heicConvertJpegOutput)

      // image magick
      const imagemagickInfo = getFileInfo("image-magick", "jpg")
      const imagemagickTimerStart = process.hrtime()
      execSync(`convert ${originalFileInfo.path} ${imagemagickInfo.path}`)
      const imagemagickTimerEnd = process.hrtime(imagemagickTimerStart)

      // image magick - png
      const imagemagickPngInfo = getFileInfo("image-magick", "png")
      const imagemagickPngTimerStart = process.hrtime()
      execSync(`convert ${originalFileInfo.path} ${imagemagickPngInfo.path}`)
      const imagemagickPngTimerEnd = process.hrtime(imagemagickPngTimerStart)

      // response
      res.json([
        originalFileInfo,
        { ...heicConvertInfo, time: getFormattedTime(heicConvertTimerEnd) },
        { ...heicConvertJpegInfo, time: getFormattedTime(heicConvertJpegTimerEnd) },
        { ...imagemagickInfo, time: getFormattedTime(imagemagickTimerEnd) },
        { ...imagemagickPngInfo, time: getFormattedTime(imagemagickPngTimerEnd) }
      ])

    }
  }
})


app.listen("3001", () => {
  console.log("test")
})