import { useLensUserContext } from '../../context/LensUserContext'
import {
  useBroadcastMutation,
  useCreateSetDispatcherTypedDataMutation
} from '../../graphql/generated'
import { useSigner, useProvider, useSignTypedData } from 'wagmi'
import { omit } from '../helpers'
import { getEmitHelpers } from 'typescript'
import { ethers } from 'ethers'
import { LensHubContractAbi, LensHubContractAddress } from '../config'
import { splitSignature } from '../ethers.service'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { usePollUntilIndexed } from '../indexer/has-transaction-been-indexed-hook'

export default function useDispatcher() {
  const { isSignedIn, data: lensProfile } = useLensUserContext()
  const { mutateAsync: createSetDispatcher } =
    useCreateSetDispatcherTypedDataMutation()
  const { mutateAsync: broadCastSignature } = useBroadcastMutation()

  const { data: signer } = useSigner()
  const provider = useProvider()
  const [typedData, setTypedData] = useState(null)
  const [dataId, setDataId] = useState(null)
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const { txResponse, handleSetRequest, requestType } =
    usePollUntilIndexed(queryClient)

  const signTypedDataResult = useSignTypedData(typedData || undefined)

  useEffect(() => {
    if (typedData && signTypedDataResult.signTypedData) {
      signTypedDataResult.signTypedData()
    }
  }, [typedData])

  useEffect(() => {
    if (signTypedDataResult?.data && dataId) {
      setDispatcherWithBroadcast(signTypedDataResult?.data, dataId)
    }
  }, [signTypedDataResult?.data, dataId])

  const setDispatcherWithBroadcast = async (signature, id) => {
    console.log('signature', signature)
    console.log('id', id)

    const broadcastResult = (
      await broadCastSignature({
        request: {
          id,
          signature
        }
      })
    ).broadcast
    console.log('broadcastResult', broadcastResult)

    if (!broadcastResult?.txHash) {
      console.error('broadcast failed')
      throw new Error('broadcast failed')
    }
    handleSetRequest('setDispatcher', { txHash: broadcastResult?.txHash })
  }

  useEffect(() => {
    if (txResponse && requestType === 'setDispatcher') {
      console.log('txResponse', txResponse)
      console.log('setDispatcher was successful')
      setLoading(false)
    }
  }, [txResponse, requestType])

  async function dispatcher() {
    setLoading(true)
    if (!isSignedIn || !lensProfile) {
      console.error('User is not signed in')
      return null
    }
    const result = (
      await createSetDispatcher({
        request: {
          profileId: lensProfile.defaultProfile?.id,
          enable: !lensProfile.defaultProfile?.dispatcher?.canUseRelay
        }
      })
    ).createSetDispatcherTypedData

    const _typedData = {
      domain: result.typedData.domain,
      types: result.typedData.types,
      value: result.typedData.value
    }
    console.log(_typedData)
    setTypedData(_typedData)
    setDataId(result.id)

    // const { domain, types, message } = typedData
    // // signing the typedData
    // const { data, isError, isLoading, isSuccess, signTypedData } =
    //   useSignTypedData({
    //     domain: omit(domain, '_typename'),
    //     types: omit(types, '_typename'),
    //     message: omit(message, '_typename')
    //   })

    // signTypedData()
    // useEffect(() => {
    //   console.log('useEffect', isError, isSuccess, isLoading, data)
    //   console.log('signature', data)
    // }, [isSuccess, isLoading, data])

    // const signature = data
    // // const signature = await  signer ._signTypedData(
    // //     omit(domain,'_typename'),
    // //     omit(types,'_typename'),
    // //     omit(message,'_typename')
    // // )
    // console.log("set dispatcher: signature", signature);

    // const {v, r, s} = splitSignature(signature)

    // const lensHub = new ethers.Contract(LensHubContractAddress,LensHubContractAbi, signer)

    // const tx = await lensHub.setDispatcherWithSig({
    //     profileId: typedData.value.profileId,
    //     dispatcher: typedData.value.dispatcher,
    //     sig: {
    //         v,
    //         r,
    //         s,
    //         deadline: typedData.value.deadline,
    //     },
    // })

    // console.log("set dispatcher: tx", tx);

    // await tx.wait()

    // console.log("set dispatcher: tx confirmed");
  }

  return { dispatcher, loading }
}
