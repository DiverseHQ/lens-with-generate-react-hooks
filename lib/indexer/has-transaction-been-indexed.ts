import {  useMutation, useQueryClient } from "@tanstack/react-query";
import { useHasTxHashBeenIndexedQuery, HasTxHashBeenIndexedRequest } from "../../graphql/generated";
// import { HasTxHashBeenIndexedDocument, HasTxHashBeenIndexedRequest } from "../../graphql/generated";

// export default function useHasTxBeenIndexed(request: HasTxHashBeenIndexedRequest) {
//     const lensHasTxBeenIndexedQuery = useHasTxHashBeenIndexedQuery(
//         {
//             request: request
//         },
//         {
//             enabled: !!request
//         }
//     )
//     return lensHasTxBeenIndexedQuery
// }

export const usePollUntilIndexed = async (request: HasTxHashBeenIndexedRequest, queryClient: any) => {
    //poll until tx is indexed
    const lensHasTxBeenIndexedQuery = useHasTxHashBeenIndexedQuery(
        {
            request: request
        },
        {
            enabled: !!request
        }
    )
    const { data, isLoading } = lensHasTxBeenIndexedQuery

    async function pollUntilIndexed() {
    const response = data?.hasTxHashBeenIndexed
    if (response) {
        if (response.__typename === 'TransactionIndexedResult') {
            console.log('pool until indexed: indexed', response.indexed);
      console.log('pool until metadataStatus: metadataStatus', response.metadataStatus);

            console.log("response.metadataStatus", response.metadataStatus)
            if (response.metadataStatus) {
                if (response.metadataStatus) {
                    if (response.metadataStatus.status === 'SUCCESS') { 
                        return response
                    }
                    if (response.metadataStatus.status === 'METADATA_VALIDATION_FAILED') {
                        throw new Error(response.metadataStatus.status)
                    }
                } else {
                    return response
                }
            }
        } else {
            throw new Error(response.reason)
        }
    }
    if (isLoading) {
        await new Promise((resolve) => setTimeout(resolve, 1500));

        //this will make the query rerun
        queryClient.invalidateQueries({
            queryKey: ["hasTxHashBeenIndexed"],
        });
    }
    }
    return useMutation(pollUntilIndexed)
}

