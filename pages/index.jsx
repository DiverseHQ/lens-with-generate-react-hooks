import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useSigner, useSignTypedData } from 'wagmi'
import useLogin from '../lib/auth/useLogin'
import { useLensUserContext } from '../context/LensUserContext'
import { useEffect, useRef, useState } from 'react'
import useDispatcher from '../lib/dispatcher/useDispatcher'
import {
  ProxyActionStatusTypes,
  useBroadcastMutation,
  useCreateProfileMutation,
  useCreateSetDefaultProfileTypedDataMutation,
  useCreateUnfollowTypedDataMutation,
  useHasTxHashBeenIndexedQuery,
  useProfilesQuery,
  useProxyActionMutation
} from '../graphql/generated'
import { BigNumber, ethers, utils } from 'ethers'
import { useQueryClient } from '@tanstack/react-query'
import { splitSignature } from '../lib/ethers.service'
import { LensHubContractAbi, LensHubContractAddress } from '../lib/config'
import { proxyActionStatusRequest } from '../lib/indexer/proxy-actino-status'
import { sleep } from '../lib/helpers'
import { pollUntilIndexed } from '../lib/indexer/has-transaction-been-indexed'

export default function Home() {
  const { address } = useAccount()
  const { data: signer } = useSigner()
  const { mutateAsync: login } = useLogin()
  const { dispatcher, loading } = useDispatcher()
  const { mutateAsync: createProfile } = useCreateProfileMutation()
  const { mutateAsync: setDefaultProfile } =
    useCreateSetDefaultProfileTypedDataMutation()
  const { mutateAsync: broadCast } = useBroadcastMutation()
  const { mutateAsync: proxyAction } = useProxyActionMutation()
  const { mutateAsync: unFollow } = useCreateUnfollowTypedDataMutation()

  const { isSignedIn, hasProfile, data: lensProfile } = useLensUserContext()

  const [profiles, setProfiles] = useState([])
  const [typedData, setTypedData] = useState(null)
  const [dataForAfterSig, setDataForAfterSig] = useState(null)

  const signTypedDataResult = useSignTypedData(typedData || undefined)

  // const {mutateAsync: pollUntilIndexed} = usePollUntilIndexed(createProfileResultData,queryClient)

  const profilesQueryResultFromLensApi = useProfilesQuery(
    {
      request: {
        ownedBy: address
      }
    },
    {
      enabled: !!address
    }
  )

  const inputRef = useRef()
  async function handleLogin() {
    await login()
  }

  async function handleDispatcher() {
    await dispatcher()
  }

  async function logFinalProfileResultsAfterResponse(result) {
    const logs = result?.txReceipt?.logs

    const topicId = utils.id(
      'ProfileCreated(uint256,address,address,string,string,address,bytes,string,uint256)'
    )

    const profileCreatedLog = logs?.find((l) => l.topics[0] === topicId)

    const profileCreatedEventLog = profileCreatedLog?.topics

    const profileId = utils.defaultAbiCoder.decode(
      ['uint256'],
      profileCreatedEventLog[1]
    )[0]

    console.log('profile id', BigNumber.from(profileId).toHexString())
  }

  const handleCreateProfile = async () => {
    const handle = inputRef.current.value
    console.log('handle', handle)
    const createProfileResult = (
      await createProfile({
        request: {
          handle
        }
      })
    ).createProfile

    if (createProfileResult.__typename === 'RelayError') {
      console.error('create profile: failed')
      return
    }

    console.log('create Profile: poll until indexed')
    console.log('createProfileResult ', createProfileResult)
    const indexedResult = await pollUntilIndexed({
      txHash: createProfileResult.txHash
    })
    console.log('indexedResult createPost', indexedResult)

    if (indexedResult && type === 'createProfile') {
      logFinalProfileResultsAfterResponse(indexedResult)
    }
    // setCreateProfileResultData({ txHash: createProfileResult.txHash });
  }

  // useEffect(() => {
  //   if (createProfileResultData && data) {
  //     pollUntilIndexed();
  //   }
  // }, [createProfileResultData, data]);

  // useEffect(() => {
  //   if (txResponse && requestType === 'createProfile') {
  //     logFinalProfileResultsAfterResponse()
  //   }
  //   if (txResponse && requestType === 'setDefaultProfile') {
  //     console.log('setDefaultProfile')
  //     logFinalResultAfterSetDefaultProfileResponse(txResponse)
  //   }
  //   if (txResponse && requestType === 'unFollow') {
  //     console.log('unFollow success')
  //     console.log('txResponse', txResponse)
  //   }
  // }, [txResponse, requestType])

  useEffect(() => {
    if (profilesQueryResultFromLensApi?.data?.profiles?.items) {
      console.log(
        'profiles of ths address',
        profilesQueryResultFromLensApi.data.profiles.items
      )
      setProfiles(profilesQueryResultFromLensApi.data.profiles.items)
    }
  }, [profilesQueryResultFromLensApi?.data?.profiles?.items])

  const handleSetDefaultProfile = async (profileId) => {
    try {
      const data = (
        await setDefaultProfile({
          request: {
            profileId
          }
        })
      ).createSetDefaultProfileTypedData

      console.log('data', data)
      const _typedData = {
        domain: data?.typedData.domain,
        types: data?.typedData.types,
        value: data?.typedData.value
      }
      setTypedData(_typedData)
      setDataForAfterSig({ id: data?.id, type: 'setDefaultProfile' })
    } catch (e) {
      console.error(e)
    }
  }

  // call contract to set default profile
  const setDefaultProfileWithSig = async () => {
    if (!signTypedDataResult.data) return
    const { v, r, s } = splitSignature(signTypedDataResult.data)
    console.log('v', v)
    console.log('r', r)
    console.log('s', s)
    const lensHubContract = new ethers.Contract(
      LensHubContractAddress,
      LensHubContractAbi,
      signer
    )
    const tx = await await lensHubContract.setDefaultProfileWithSig({
      profileId: typedData.value.profileId,
      wallet: typedData.value.wallet,
      sig: {
        v,
        r,
        s,
        deadline: typedData.value.deadline
      }
    })
    console.log('tx', tx)
    const receipt = await tx.wait()
    console.log('receipt', receipt)
  }

  // use broadcast for gasless transactions
  const broadCastSignatureForGaslessTransaction = async (
    signature,
    id,
    type
  ) => {
    console.log('signature', signature)
    console.log('id', id)
    console.log('type', type)
    const broadcastResult = (
      await broadCast({
        request: {
          id,
          signature
        }
      })
    ).broadcast
    console.log('data', broadcastResult)
    if (!broadcastResult.txHash) {
      console.log('broadcastResult', broadcastResult)
      throw new Error('broadcastResult.txHash is undefined')
    }
    console.log('broadcastFunc poll until indexed start')
    const indexedResult = await pollUntilIndexed({
      txHash: broadcastResult.txHash
    })
    console.log('indexedResult', indexedResult)
    console.log('broadcastFunc poll until indexed end')
  }

  const logFinalResultAfterSetDefaultProfileResponse = (resp) => {
    const indexedResult = resp

    const logs = indexedResult.txReceipt.logs

    console.log('follow with broadcast: logs', logs)
  }

  // singTypedData if typedData is set
  useEffect(() => {
    if (typedData && signTypedDataResult.signTypedData) {
      signTypedDataResult.signTypedData()
    }
  }, [typedData])

  useEffect(() => {
    if (
      signTypedDataResult?.data &&
      dataForAfterSig?.type &&
      dataForAfterSig?.id
    ) {
      broadCastSignatureForGaslessTransaction(
        signTypedDataResult?.data,
        dataForAfterSig.id,
        dataForAfterSig.type
      )
    }
  }, [signTypedDataResult?.data, dataForAfterSig])

  const handleFollowProfile = async (profileId) => {
    const followProfileResult = (
      await proxyAction({
        request: {
          follow: {
            freeFollow: {
              profileId: profileId
            }
          }
        }
      })
    ).proxyAction
    console.log('followProfileResult index start', followProfileResult)

    // waiting untill proxy action is complete
    while (true) {
      try {
        const statusResult = await proxyActionStatusRequest(followProfileResult)
        console.log('statusResult', statusResult)
        if (statusResult.status === ProxyActionStatusTypes.Complete) {
          console.log('proxy action free follow: complete', statusResult)
          break
        }
      } catch (e) {
        console.error(e)
        break
      }
      await sleep(1000)
    }

    console.log('followProfileResult index end', followProfileResult)
  }

  const handleUnfollowProfile = async (profileId) => {
    const unfollowProfileResult = (
      await unFollow({
        request: {
          profile: profileId
        }
      })
    ).createUnfollowTypedData
    console.log('unfollowProfileResult', unfollowProfileResult)

    const _typedData = {
      domain: unfollowProfileResult?.typedData.domain,
      types: unfollowProfileResult?.typedData.types,
      value: unfollowProfileResult?.typedData.value
    }

    setTypedData(_typedData)
    setDataForAfterSig({
      id: unfollowProfileResult?.id,
      type: 'unfollowProfile'
    })
  }

  return (
    <>
      <div style={{ margin: '50px' }}>
        <ConnectButton />
        {address && signer && (
          <div>
            <div>Address: {address}</div>
            <button onClick={handleLogin}>Lens Login </button>
          </div>
        )}
        <div style={{ marginTop: '20px' }}>
          Default Profile fetched from lens:{' '}
        </div>
        <div>isSignedIN : {isSignedIn ? 'True' : 'false'}</div>
        <div>hasProfile : {hasProfile ? 'True' : 'False'}</div>
        <div>
          Profile Handle : {hasProfile && lensProfile?.defaultProfile?.handle}
        </div>
        <div>
          Can use Dispatcher :{' '}
          {hasProfile && lensProfile?.defaultProfile?.dispatcher?.canUseRelay
            ? 'True'
            : 'False'}
        </div>
        <button onClick={handleDispatcher} style={{ marginTop: '20px' }}>
          Dispatcher
        </button>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <input ref={inputRef} type="text" style={{ marginTop: '20px' }} />
          <button onClick={handleCreateProfile}>Create Profile</button>
        </div>

        <div style={{ marginTop: '50px' }}>
          <div>Profiles of this address</div>
          {profiles.map((profile) => {
            return (
              <div key={profile.id} style={{ marginTop: '20px' }}>
                <div>Profile ID: {profile.id}</div>
                <div>Profile Handle: {profile.handle}</div>
                <div>
                  Profile IsDefault: {profile.isDefault ? 'True' : 'False'}
                </div>
                <div>
                  isFollowedByMe: {profile.isFollowedByMe ? 'True' : 'False'}
                </div>
                <div>
                  isFollowingMe: {profile.isFollowing ? 'True' : 'False'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {profile.isFollowedByMe ? (
                    <button
                      onClick={() => {
                        handleUnfollowProfile(profile.id)
                      }}
                    >
                      UnFollow
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        handleFollowProfile(profile.id)
                      }}
                    >
                      Follow
                    </button>
                  )}
                  <button
                    onClick={() => {
                      handleSetDefaultProfile(profile.id)
                    }}
                  >
                    Set as Default Profile
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
