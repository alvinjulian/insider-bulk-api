# insider-bulk-api
 Bulk API CSV Processor

This project only applied to Use Insider API, specifically to delete the user profile in bulk from CSV.

`
curl --location --request POST 'http://localhost:8000/insider/bulk-delete' \
--form 'file=@"/path/to/file"' \
--form 'partnername=""' \
--form 'requesttoken=""'
`