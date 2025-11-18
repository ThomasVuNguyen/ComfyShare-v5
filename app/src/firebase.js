import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import config from '../firebase.config'

const app = initializeApp(config)
const db = getFirestore(app)

export { db }
