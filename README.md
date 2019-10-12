# Bost Contract Revisions

## 1. Update repo to latest version

```bash
git pull
```

## 2. Generate Transaction Request


Change (or add/remove) `--signers` to whoever will sign this contract.

```bash
iwallet \
--gas_limit 2000000 \
--amount_limit '*:unlimited' \
publish --update bost.js bost.abi  \
Contract42r4wVfwG8prZcSJ86HtBc5SThKbaLUhN6cBCWJfr8Xv \
--signers account1@active \
--signers account2@active \
--signers account3@active \
--tx_time_delay 1800 --output unsign_contract.json
```

## 3. Distribute `unsign_contract.json` to `ALL signers`

Distribute the file `unsign_contract.json` to every signers who in the previous command.


## 4. Sign contract (in each signers' computer)

```
iwallet sign [替换为unsign_contract.json的路径] [替换为iwallet私钥文件路径] sig.json
```

## 5. Gather all sig.json files to publisher's computer and publish the transaction

Specific `--signature_files` to all sig.json files gathered in the previous step.

```
iwallet \
-s 54.180.196.80:30002 \
send unsign_contract.json \
--signature_files sig1.json \
--signature_files sig2.json \
--signature_files sig3.json \
--account [替换为任意有足够Gas的、用于推送合约的账号]
```
