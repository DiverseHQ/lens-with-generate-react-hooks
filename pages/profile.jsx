import React, { useEffect, useRef, useState } from 'react'
import {
  PublicationMainFocus,
  PublicationTypes,
  useBroadcastMutation,
  useCreatePostTypedDataMutation,
  useCreatePostViaDispatcherMutation,
  useProfileFeedQuery,
  usePublicationsQuery
} from '../graphql/generated'
import { useLensUserContext } from '../context/LensUserContext'
import { pinJSONToIPFS, uploadIpfsGetPath } from '../utils/utils'
import { v4 as uuidv4 } from 'uuid'
import { useSignTypedData } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { usePollUntilIndexed } from '../lib/indexer/has-transaction-been-indexed'

const profile = () => {
  const { isSignedIn, hasProfile, data: lensProfile } = useLensUserContext()

  const [dataId, setDataId] = useState(null)
  const [typedData, setTypedData] = useState(null)
  const signTypedDataResult = useSignTypedData(typedData || undefined)

  const { mutateAsync: createPostViaDispatcher } =
    useCreatePostViaDispatcherMutation()
  const { mutateAsync: createPostViaSignedTx } =
    useCreatePostTypedDataMutation()
  const { mutateAsync: broadCast } = useBroadcastMutation()

  const queryClient = useQueryClient()
  const { txResponse, handleSetRequest, polling, requestType } =
    usePollUntilIndexed(queryClient)

  const [publications, setPublications] = useState([])

  const inputRef = useRef()

  const feedQueryResult = useProfileFeedQuery(
    {
      request: {
        profileId: lensProfile?.defaultProfile?.id,
        limit: 10
      }
    },
    {
      enabled: !!lensProfile?.defaultProfile?.id
    }
  )

  const getPublicatiosnQueryResult = usePublicationsQuery(
    {
      request: {
        profileId: lensProfile?.defaultProfile?.id,
        publicationTypes: [
          PublicationTypes.Post,
          PublicationTypes.Comment,
          PublicationTypes.Mirror
        ]
      }
    },
    {
      enabled: !!lensProfile?.defaultProfile?.id
    }
  )

  useEffect(() => {
    console.log(feedQueryResult?.data)
  }, [feedQueryResult?.data])

  useEffect(() => {
    if (getPublicatiosnQueryResult?.data?.publications?.items) {
      console.log(
        'publications',
        getPublicatiosnQueryResult?.data.publications.items
      )
      setPublications(getPublicatiosnQueryResult?.data.publications.items)
    }
  }, [getPublicatiosnQueryResult?.data])

  const post = async (createPostRequest) => {
    if (lensProfile?.defaultProfile?.dispatcher?.canUseRelay) {
      //gasless using dispatcher
      const dispatcherResult = (
        await createPostViaDispatcher({
          request: createPostRequest
        })
      ).createPostViaDispatcher
      console.log(dispatcherResult)
      handleSetRequest('dispatherResult', { txId: dispatcherResult.txId })
    } else {
      //gasless using signed broadcast
      const postTypedResult = (
        await createPostViaSignedTx({
          request: createPostRequest
        })
      ).createPostTypedData
      console.log('postTypedResult', postTypedResult)

      const _typedData = {
        domain: postTypedResult.typedData.domain,
        types: postTypedResult.typedData.types,
        value: postTypedResult.typedData.value
      }
      setDataId(postTypedResult.id)
      setTypedData(_typedData)
    }
  }

  useEffect(() => {
    if (typedData && signTypedDataResult.signTypedData) {
      signTypedDataResult.signTypedData()
    }
  }, [typedData])

  useEffect(() => {
    if (signTypedDataResult?.data && dataId) {
      createPostWithBroadcastUsingSignedTx(signTypedDataResult?.data, dataId)
    }
  }, [signTypedDataResult?.data, dataId])

  const createPostWithBroadcastUsingSignedTx = async (signature, id) => {
    const broadcastResult = (
      await broadCast({
        request: {
          id,
          signature
        }
      })
    ).broadcast
    console.log('broadcastResult', broadcastResult)
    handleSetRequest('broadcastResult', { txHash: broadcastResult.txHash })
  }

  const handleCreatePost = async () => {
    const textContent = inputRef.current.value
    if (!textContent) return
    const ipfsHash = await uploadIpfsGetPath({
      version: '2.0.0',
      mainContentFocus: PublicationMainFocus.TextOnly,
      metadata_id: uuidv4(),
      description: 'Description',
      locale: 'en-US',
      content: textContent,
      external_url: null,
      image: null,
      imageMimeType: null,
      name: 'Name',
      attributes: [],
      tags: []
    })
    console.log(ipfsHash)
    const createPostRequest = {
      profileId: lensProfile?.defaultProfile?.id,
      contentURI: `ipfs://${ipfsHash}`,
      collectModule: { freeCollectModule: { followerOnly: true } },
      referenceModule: {
        followerOnlyReferenceModule: false
      }
    }
    await post(createPostRequest)
  }

  useEffect(() => {
    if (txResponse && requestType === 'broadcastResult') {
      console.log('broadcastResult', txResponse)
    }
    if (txResponse && requestType === 'dispatherResult') {
      console.log('dispatherResult', txResponse)
    }
  }, [txResponse, requestType])
  return (
    <div>
      <h1>Profile</h1>
      <div>
        Can Use Dispatcher :{' '}
        {lensProfile?.defaultProfile?.dispatcher?.canUseRelay
          ? 'True'
          : 'false'}
      </div>
      <div>Profile Id : {lensProfile?.defaultProfile?.id || 'No Profile'}</div>
      <input type="text" ref={inputRef} placeholder="What's on your mind?" />
      <button
        onClick={handleCreatePost}
        disabled={!lensProfile?.defaultProfile?.id}
      >
        Create Post
      </button>

      <div style={{ marginTop: '30px' }}>
        {publications.map((publication) => {
          return (
            <div key={publication.id} style={{ marginBottom: '20px' }}>
              <div>id: {publication.id}</div>
              <div>
                createdAt :{' '}
                {
                  // human readable data
                  new Date(publication.createdAt).toLocaleString()
                }
              </div>
              <div>
                totalAmountOfComments: {publication.stats.totalAmountOfComments}
              </div>
              <div>content: {publication.metadata.content} </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default profile
