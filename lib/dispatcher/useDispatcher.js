import { useLensUserContext } from "../../context/LensUserContext";
import { useCreateSetDispatcherTypedDataMutation } from "../../graphql/generated";
import { useSigner, useProvider, useSignTypedData } from "wagmi";
import { omit } from "../helpers";
import { getEmitHelpers } from "typescript";
import { ethers } from "ethers";
import { LensHubContractAbi, LensHubContractAddress } from "../config";
import { splitSignature } from "../ethers.service";
import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";

export default function useDispatcher() {
  const { isSignedIn, data: lensProfile } = useLensUserContext();
  const { mutateAsync: createSetDispatcher } =
    useCreateSetDispatcherTypedDataMutation();
  const { data: signer } = useSigner();
  const provider = useProvider();
  async function dispatcher() {
    if (!isSignedIn || !lensProfile) {
      console.error("User is not signed in");
      return null;
    }
    const result = (
      await createSetDispatcher({
        request: {
          profileId: lensProfile.defaultProfile?.id,
          enable: !lensProfile.defaultProfile?.dispatcher?.canUseRelay,
        },
      })
    ).createSetDispatcherTypedData;

    const typedData = result.typedData;
    console.log(typedData);

    const { domain, types, message } = typedData;
    // signing the typedData
    const { data, isError, isLoading, isSuccess, signTypedData } =
      useSignTypedData({
        domain: omit(domain, "_typename"),
        types: omit(types, "_typename"),
        message: omit(message, "_typename"),
      });

    signTypedData();
    useEffect(() => {
      console.log("useEffect", isError, isSuccess, isLoading, data);
      console.log("signature", data);
    }, [isSuccess, isLoading, data]);

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

  return useMutation(dispatcher);
}
