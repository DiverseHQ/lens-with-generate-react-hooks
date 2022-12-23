import axios from 'axios'
import { create } from 'ipfs-http-client'

export const uploadFileToIpfsPinata = async (file) => {
  const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`
  const data = new FormData()
  data.append('file', file)
  return axios
    .post(url, data, {
      maxBodyLength: Infinity,
      headers: {
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT}`
      }
    })
    .then((response) => {
      return response.data.IpfsHash
    })
    .catch((error) => {
      console.log(error)
    })
}

export const pinJSONToIPFS = async (JSONBody) => {
  const url = `https://api.pinata.cloud/pinning/pinJSONToIPFS`
  return axios
    .post(url, JSONBody, {
      headers: {
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT}`
      }
    })
    .then(function (response) {
      return response.data.IpfsHash
      //handle response here
    })
    .catch(function (error) {
      console.log(error)
      alert(error)
      //handle error here
    })
}

const client = create({
  host: 'ipfs.infura.io',
  port: 5001,
  protocol: 'https',
  headers: {
    authorization: `Basic ${Buffer.from(
      `${process.env.NEXT_PUBLIC_INFURA_PROJECT_ID}:${process.env.NEXT_PUBLIC_INFURA_API_SECRET}`,
      'utf-8'
    ).toString('base64')}`
  }
})

export const uploadIpfs = async (data) => {
  const result = await client.add(JSON.stringify(data))

  console.log('upload result ipfs', result)
  return result
}

export const uploadIpfsGetPath = async (data) => {
  const result = await client.add(JSON.stringify(data))

  console.log('upload result ipfs', result)
  return result.path
}
