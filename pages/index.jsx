import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSigner } from "wagmi";
import useLogin from "../lib/auth/useLogin";
import { useLensUserContext } from "../context/LensUserContext";
import { useEffect, useRef, useState } from "react";
import useDispatcher from "../lib/dispatcher/useDispatcher";
import {
  useCreateProfileMutation,
  useCreateSetDefaultProfileTypedDataMutation,
  useHasTxHashBeenIndexedQuery,
  useProfilesQuery,
} from "../graphql/generated";
import { BigNumber, utils } from "ethers";
import { useQueryClient } from "@tanstack/react-query";

export default function Home() {
  const { address } = useAccount();
  const { data: signer } = useSigner();
  const { mutateAsync: login } = useLogin();
  const { mutateAsync: dispatcher } = useDispatcher();
  const { mutateAsync: createProfile } = useCreateProfileMutation();
  const { mutateAsync: setDefaultProfile } =
    useCreateSetDefaultProfileTypedDataMutation();
  const { isSignedIn, hasProfile, data: lensProfile } = useLensUserContext();
  const [createProfileResultData, setCreateProfileResultData] = useState(null);
  const [pollUntilIndexedResponse, setPollUntilIndexedResponse] =
    useState(null);
  const [profiles, setProfiles] = useState([]);

  const queryClient = useQueryClient();
  // const {mutateAsync: pollUntilIndexed} = usePollUntilIndexed(createProfileResultData,queryClient)

  const profilesQueryResultFromLensApi = useProfilesQuery(
    {
      request: {
        ownedBy: address,
      },
    },
    {
      enabled: !!address,
    }
  );

  const inputRef = useRef();
  async function handleLogin() {
    await login();
  }

  async function handleDispatcher() {
    await dispatcher();
  }

  const lensHasTxBeenIndexedQuery = useHasTxHashBeenIndexedQuery(
    {
      request: createProfileResultData,
    },
    {
      enabled: !!createProfileResultData,
    }
  );
  const { data, isLoading } = lensHasTxBeenIndexedQuery;

  async function pollUntilIndexed() {
    console.log("pollUntilIndexed", data);
    const response = data?.hasTxHashBeenIndexed;
    if (response) {
      if (response.__typename === "TransactionIndexedResult") {
        console.log("pool until indexed: indexed", response.indexed);
        console.log(
          "pool until metadataStatus: metadataStatus",
          response.metadataStatus
        );

        console.log("response.metadataStatus", response.metadataStatus);
        if (response.metadataStatus) {
          if (response.metadataStatus.status === "SUCCESS") {
            setPollUntilIndexedResponse(response);
            return;
          }
          if (response.metadataStatus.status === "METADATA_VALIDATION_FAILED") {
            throw new Error(response.metadataStatus.status);
          }
        } else {
          if (response.indexed) {
            setPollUntilIndexedResponse(response);
            return;
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // this will make the query rerun
        queryClient.invalidateQueries({
          queryKey: ["hasTxHashBeenIndexed"],
        });
      } else {
        throw new Error(response.reason);
      }
    }
  }

  async function logFinalResultsAfterResponse() {
    console.log("pollUntilIndexedResponse", pollUntilIndexedResponse);
    const result = pollUntilIndexedResponse;
    console.log("result", result);

    const logs = result?.txReceipt?.logs;

    console.log("create profile: logs", logs);

    const topicId = utils.id(
      "ProfileCreated(uint256,address,address,string,string,address,bytes,string,uint256)"
    );
    console.log("topicid we care about", topicId);

    const profileCreatedLog = logs?.find((l) => l.topics[0] === topicId);
    console.log("profile created log", profileCreatedLog);

    const profileCreatedEventLog = profileCreatedLog?.topics;
    console.log("profile created event logs", profileCreatedEventLog);

    const profileId = utils.defaultAbiCoder.decode(
      ["uint256"],
      profileCreatedEventLog[1]
    )[0];

    console.log("profile id", BigNumber.from(profileId).toHexString());
  }

  useEffect(() => {
    console.log("lensProfile", lensProfile);
  }, [lensProfile]);

  async function handleCreateProfile() {
    const handle = inputRef.current.value;
    console.log("handle", handle);
    const createProfileResult = (
      await createProfile({
        request: {
          handle,
        },
      })
    ).createProfile;

    console.log("createProfileResult", createProfileResult);
    if (createProfileResult.__typename === "RelayError") {
      console.error("create profile: failed");
      return;
    }

    console.log("create Profile: poll until indexed");
    console.log("createProfileResult ", createProfileResult);
    setCreateProfileResultData({ txHash: createProfileResult.txHash });
  }

  useEffect(() => {
    if (createProfileResultData && data) {
      pollUntilIndexed();
    }
  }, [createProfileResultData, data]);

  useEffect(() => {
    if (pollUntilIndexedResponse) {
      logFinalResultsAfterResponse();
    }
  }, [pollUntilIndexedResponse]);

  useEffect(() => {
    if (profilesQueryResultFromLensApi.data) {
      console.log(
        "profiles",
        profilesQueryResultFromLensApi.data.profiles.items
      );
      setProfiles(profilesQueryResultFromLensApi.data.profiles.items);
    }
  }, [profilesQueryResultFromLensApi]);

  const handleSetDefaultProfile = async (profileId) => {
    const data = (
      await setDefaultProfile({
        request: {
          profileId,
        },
      })
    ).createSetDefaultProfileTypedData;

    console.log("data", data);
  };

  return (
    <>
      <div style={{ margin: "50px" }}>
        <ConnectButton />
        {address && signer && (
          <div>
            <div>Address: {address}</div>
            <button onClick={handleLogin}>Lens Login </button>
          </div>
        )}
        <div style={{ marginTop: "20px" }}>
          Default Profile fetched from lens:{" "}
        </div>
        <div>isSignedIN : {isSignedIn ? "True" : "false"}</div>
        <div>hasProfile : {hasProfile ? "True" : "False"}</div>
        <div>
          Profile Handle : {hasProfile && lensProfile?.defaultProfile?.handle}
        </div>
        <div>
          Can use Dispatcher :{" "}
          {hasProfile && lensProfile?.defaultProfile?.dispatcher?.canUseRelay
            ? "True"
            : "False"}
        </div>
        <button onClick={handleDispatcher} style={{ marginTop: "20px" }}>
          Dispatcher
        </button>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <input ref={inputRef} type="text" style={{ marginTop: "20px" }} />
          <button onClick={handleCreateProfile}>Create Profile</button>
        </div>

        <div style={{ marginTop: "50px" }}>
          <div>Profiles of this address</div>
          {profiles.map((profile) => {
            return (
              <div key={profile.id} style={{ marginTop: "20px" }}>
                <div>Profile ID: {profile.id}</div>
                <div>Profile Handle: {profile.handle}</div>
                <div>
                  Profile IsDefault: {profile.isDefault ? "True" : "False"}
                </div>
                <div>
                  Profile CanUseDispatcher:{" "}
                  {profile.dispatcher?.canUseRelay ? "True" : "False"}
                </div>
                <button
                  onClick={() => {
                    handleSetDefaultProfile(profile.id);
                  }}
                >
                  Set as Default Profile
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
