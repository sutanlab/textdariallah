import { Router } from 'express'
import { SECRET_CODE } from './config'
import { publishPost } from './instagram'

const route = Router()

route.get('/publish', async (req, res) => {
  const { secret } = req.query

  if (secret !== SECRET_CODE) {
    return res.status(403).send('Access Forbidden')
  }

  const runTask = async (): Promise<any> => {
    try {
      await publishPost()
      return res.status(200).send('Success Publishing Post!')
    } catch (reason) {
      const { response } = reason
      
      if (response?.body) {
        const { message } = response.body
        if (message.includes('aspect ratio')) {
          console.error('> Error on aspect ratio surah, try again...\n')
          return runTask()
        }
      }
      
      console.error('Error on publishing surah:', reason)
      return res.status(500)
        .send('Something went wrong, try again later.')
    }
  }
  
  runTask()
})

export default route