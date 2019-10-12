const IOST_PER_PERIOD = 250000
const HOLDER_REWARD_SECTION = 1000
const LUCKY_REWARD_SECTION = 400
const BID_REWARD_SECTION = 2000
const TOTAL_PERIOD = 4000
const BID_PRICE = 1000
const ACTIVE_PERMISSION = 'active'
const CONTRACT_VERSION = '1.0.3'
class Bost {
    init() {
        storage.put("period_number", "1")   //期数
        storage.put("period_pool", "0")     //当期完成额度
        storage.put("iost_pool", "0")       //IOST总共振数量
        storage.put("last_holder_reward_period", "0")
        storage.put("last_lucky_reward_period", "0")
        storage.put("last_bid_reward_period", "0")
        storage.put("bost_holder_length", "0")
        storage.put("bid_length", "0")
    }
    can_update(data) {
        const producers = [
            'bostlyx1',
            'bostlyx2',
            'bostlyx3'
        ];
        let count = 0;
        for (let i = 0; i < producers.length; i++) {
            if (blockchain.requireAuth(producers[i], ACTIVE_PERMISSION)) {
                count++;
            }
        }
        if (count >= 2) { return true; }
    }
    //exchange BOST with IOST
    resonanceBOST(am) {
        let amount = Number(am)
        if (amount > 250000) {
            throw "amount should less then 250000"
        }
        const period = this._getPeriodNum()
        const periodPool = this._getPeriodPool()
        const iostPool = this._getIOSTPool()
        blockchain.deposit(tx.publisher, amount * 0.7, "Resonance deposit")
        blockchain.callWithAuth("token.iost", "transfer", ["iost", tx.publisher, "bostbonus", String(amount * 0.3), "extraiostbonus"])
        if (amount + periodPool < IOST_PER_PERIOD) {
            let bost = this._getBOSTExchangeRate(period) * amount
            blockchain.callWithAuth("token.iost", "transfer", ["bost", blockchain.contractName(), tx.publisher, String(bost), "Resonance"])
            this._setPeriodPool(amount + periodPool)
            this._setIOSTPool(amount + iostPool)
        } else {
            let bost = 0
            let existPool = periodPool
            let balance = amount
            let runningPeriod = period
            while (balance > 0) {
                if (balance + existPool < IOST_PER_PERIOD) {
                    bost += this._getBOSTExchangeRate(runningPeriod) * balance
                    existPool += balance
                    balance = 0
                } else {
                    const part = IOST_PER_PERIOD - existPool
                    bost += this._getBOSTExchangeRate(runningPeriod) * part
                    balance -= part
                    existPool = 0
                    runningPeriod++
                }
            }
            blockchain.callWithAuth("token.iost", "transfer", ["bost", blockchain.contractName(), tx.publisher, String(bost), "Resonance"])
            this._setPeriodNum(runningPeriod)
            this._setPeriodPool(existPool)
            this._setIOSTPool(iostPool + amount)
        }
        //make holder index
        let newHolder = !storage.mapHas("bost_holder_balance", tx.publisher)
        if (newHolder) {
            let len = Number(storage.get("bost_holder_length"))
            storage.mapPut("bost_holder_index", String(len), tx.publisher)
            storage.put("bost_holder_length", String(len + 1))
        }
        //increase holder balance
        let balance = 0
        if (!newHolder) {
            balance = Number(storage.mapGet("bost_holder_balance", tx.publisher))
        }
        storage.mapPut("bost_holder_balance", tx.publisher, String(balance + amount))

        //active reward
        this._reward()
    }
    //Create BID
    createBID(inviter) {

        if (storage.mapHas("bid_relation", tx.publisher)) {
            throw "bid exist"
        }
        let accountExist = storage.globalMapHas("auth.iost", "auth", inviter)
        if (!accountExist) {
            blockchain.callWithAuth("token.iost", "transfer", ["bost", tx.publisher, blockchain.contractName(), String(BID_PRICE), "Buy a BID"])
            let len = Number(storage.get("bid_length"))
            storage.mapPut("bid_index", String(len), tx.publisher)
            storage.put("bid_length", String(len + 1))
            blockchain.callWithAuth("token.iost", "destroy", ["bost", blockchain.contractName(), String(BID_PRICE)])
            storage.mapPut("bid_relation", tx.publisher, "-")
            return
        }
        blockchain.callWithAuth("token.iost", "transfer", ["bost", tx.publisher, blockchain.contractName(), String(BID_PRICE), "Buy a BID"])
        storage.mapPut("bid_relation", tx.publisher, inviter)
        let len = Number(storage.get("bid_length"))
        storage.mapPut("bid_index", String(len), tx.publisher)
        storage.put("bid_length", String(len + 1))
        blockchain.callWithAuth("token.iost", "transfer", ["bost", blockchain.contractName(), inviter, String(BID_PRICE * 0.5), "Bonus for Inviter"])
        let fissionLv1 = 0
        if (storage.mapHas("bid_fission_lv1_count", inviter)) {
            fissionLv1 = Number(storage.mapGet("bid_fission_lv1_count", inviter))
        }
        storage.mapPut("bid_fission_lv1_count", inviter, String(fissionLv1 + 1))
        let fissionTotal = 0
        if (storage.mapHas("bid_fission_total", inviter)) {
            fissionTotal = Number(storage.mapGet("bid_fission_total", inviter))
        }
        storage.mapPut("bid_fission_total", inviter, String(fissionTotal + 1))
        //increase bonus
        let bonus = 0
        if (storage.mapHas("bost_bonus", inviter)) {
            bonus = Number(storage.mapGet("bost_bonus", inviter))
        }
        storage.mapPut("bost_bonus", inviter, String(bonus + BID_PRICE * 0.5))
        let level = 9
        let child = inviter
        while (level > 0) {
            level--
            if (storage.mapHas("bid_relation", child)) {
                let parent = storage.mapGet("bid_relation", child)
                if (storage.globalMapHas("auth.iost", "auth", parent)) {
                    blockchain.callWithAuth("token.iost", "transfer", ["bost", blockchain.contractName(), parent, String(BID_PRICE * 0.05), "Buy a BID"])
                    let bonus = 0
                    if (storage.mapHas("bost_bonus", parent)) {
                        bonus = Number(storage.mapGet("bost_bonus", parent))
                    }
                    storage.mapPut("bost_bonus", parent, String(bonus + BID_PRICE * 0.05))
                    let fissionTotal = 0
                    if (storage.mapHas("bid_fission_total", parent)) {
                        fissionTotal = Number(storage.mapGet("bid_fission_total", parent))
                    }
                    storage.mapPut("bid_fission_total", parent, String(fissionTotal + 1))
                    child = parent
                } else {
                    break
                }
            } else {
                break
            }
        }
        //destory BOST
        let destory = BID_PRICE * (1 - 0.5 - 0.05 * level)
        blockchain.callWithAuth("token.iost", "destroy", ["bost", blockchain.contractName(), String(destory)])
    }

    _reward() {

        let reward = false
        let period = this._getPeriodNum()
        if (!reward && period >= HOLDER_REWARD_SECTION + Number(storage.get("last_holder_reward_period"))) {
            reward = true
            this._holderReward(period)
        }

        if (!reward && period >= LUCKY_REWARD_SECTION + Number(storage.get("last_lucky_reward_period"))) {
            reward = true
            this._luckyReward(period)
        }
        if (!reward && period >= BID_REWARD_SECTION + Number(storage.get("last_bid_reward_period"))) {
            reward = true
            this._bidReward(period)
        }
        if (!reward) {

        }
    }

    _holderReward(pr) {
        //For Holder
        let period = Number(pr)
        let lastRerawd = Number(storage.get("last_holder_reward_period"))
        if (period <= lastRerawd) {
            return
        }
        const totalBonus = IOST_PER_PERIOD * HOLDER_REWARD_SECTION * 0.7 //派奖阶段总IOST池


        let holderLength = Number(storage.get("bost_holder_length"))
        let holders = new Array()    //共振参与者
        for (let i = 0; i < holderLength; i++) {
            let ac = storage.mapGet("bost_holder_index", String(i))
            let ba = Number(storage.mapGet("bost_holder_balance", ac))
            holders.push({ account: ac, balance: ba })
        }
        function sortByBalance(a, b) {
            return b.balance - a.balance
        }
        holders.sort(sortByBalance)
        if (holders.length > 0) blockchain.withdraw(holders[0].account, String(totalBonus * 0.05), "BOST Holder Bonus for 1st") //第一名
        if (holders.length > 1) blockchain.withdraw(holders[1].account, String(totalBonus * 0.035), "BOST Holder Bonus for 2nd") //第二名
        if (holders.length > 2) blockchain.withdraw(holders[2].account, String(totalBonus * 0.025), "BOST Holder Bonus for 3rd") //第三名
        if (holders.length > 3) blockchain.withdraw(holders[3].account, String(totalBonus * 0.01), "BOST Holder Bonus for 4th") //第四名
        for (let i = 4; i < ((holders.length >= 10) ? 10 : holders.length); i++) {  //5~10
            blockchain.withdraw(holders[i].account, String(totalBonus * 0.005), "BOST Holder Bonus for " + (i + 1) + "th")
        }
        for (let i = 10; i < ((holders.length >= 100) ? 100 : holders.length); i++) {  //11~100
            blockchain.withdraw(holders[i].account, String(totalBonus * 0.00066667), "BOST Holder Bonus for " + (i + 1) + "th")
        }
        storage.put("last_holder_reward_period", String(period))
    }
    _luckyReward(pr) {
        let period = Number(pr)
        let lastRerawd = Number(storage.get("last_lucky_reward_period"))
        if (period <= lastRerawd) {
            return
        }
        let numA = tx.hash.charCodeAt(0) % 10
        let numB = -1
        let index = 1
        while (numB < 0 || numB === numA) {
            if (index < tx.hash.length) {
                numB = tx.hash.charCodeAt(index) % 10
            }
        }
        if (numB === -1) numB = 9   //Lucky Number
        let holderLength = Number(storage.get("bost_holder_length"))
        const totalBonus = IOST_PER_PERIOD * LUCKY_REWARD_SECTION * 0.7 //派奖阶段总IOST池
        const bonusForOne = totalBonus * 0.2 / (holderLength * 0.2) //每个幸运奖金额
        let count = 0, slice = 1
        for (let i = 0; i < holderLength; i++) {
            if (i % 10 === numA || i % 10 === numB) {
                count++
                if (count >= 50) {
                    count = 0
                    slice++
                }
                let account = storage.mapGet("bost_holder_index", String(i))
                storage.mapPut("lucky_reward" + String(slice), account, String(bonusForOne))
            }
        }
        storage.put("last_lucky_reward_period", String(period))
    }
    _sendLuckyReward() {
        let slice = 0
        while (true) {
            if (storage.has("lucky_reward" + String(slice))) {
                slice++
            } else {
                break
            }
        }
        if (slice > 0) {
            let keys = storage.mapKeys("lucky_reward" + String(slice))
            for (let i = 0; i < keys.length; i++) {
                let value = storage.mapGet("lucky_reward" + String(slice), keys[i])
                blockchain.withdraw(key, value, "BOST Lucky Bonus")
            }
            storage.del("lucky_reward" + String(slice))
        }
    }
    _bidReward(pr) {
        let period = Number(pr)
        let lastRerawd = Number(storage.get("last_bid_reward_period"))
        if (period <= lastRerawd) {
            return
        }
        const bidBonus = IOST_PER_PERIOD * BID_REWARD_SECTION * 0.7 * 0.5 //派奖阶段总IOST池

        let bids = []    //bid账号
        let bidLength = Number(storage.get("bid_length"))
        for (let i = 0; i < bidLength; i++) {
            let account = storage.mapGet("bid_index", String(i))
            let bonus = Number(storage.mapGet("bost_bonus", account))
            bids.push({
                account: account,
                bonus: bonus
            })
        }
        function sortByBonus(a, b) {
            return b.bonus - a.bonus
        }
        bids.sort(sortByBonus)
        if (bids.length > 0) blockchain.withdraw(bids[0].account, String(bidBonus * 0.24), "BID Bonus for 1st") //第一名
        if (bids.length > 1) blockchain.withdraw(bids[1].account, String(bidBonus * 0.18), "BID Bonus for 2nd") //第二名
        if (bids.length > 2) blockchain.withdraw(bids[2].account, String(bidBonus * 0.15), "BID Bonus for 3rd") //第三名
        if (bids.length > 3) blockchain.withdraw(bids[3].account, String(bidBonus * 0.12), "BID Bonus for 4th") //第四名
        if (bids.length > 4) blockchain.withdraw(bids[4].account, String(bidBonus * 0.10), "BID Bonus for 5th") //第五名
        if (bids.length > 5) blockchain.withdraw(bids[5].account, String(bidBonus * 0.08), "BID Bonus for 6th") //第六名
        if (bids.length > 6) blockchain.withdraw(bids[6].account, String(bidBonus * 0.05), "BID Bonus for 7th") //第七名
        if (bids.length > 7) blockchain.withdraw(bids[7].account, String(bidBonus * 0.04), "BID Bonus for 8th") //第八名
        if (bids.length > 8) blockchain.withdraw(bids[8].account, String(bidBonus * 0.03), "BID Bonus for 9th") //第九名
        if (bids.length > 9) blockchain.withdraw(bids[9].account, String(bidBonus * 0.01), "BID Bonus for 10th") //第十名

        for (let i = 10; i < ((bids.length >= 100) ? 100 : bids.length); i++) {  //11~100
            blockchain.withdraw(bids[i].account, String(bidBonus * 0.00333333), "BID Bonus for " + (i + 1) + "th")
        }
        storage.put("last_bid_reward_period", String(period))
    }
    _getPeriodNum() {
        return Number(storage.get("period_number"))
    }
    _setPeriodNum(num) {
        storage.put("period_number", String(num))
    }
    _getPeriodPool() {
        return Number(storage.get("period_pool"))
    }
    _setPeriodPool(amount) {
        storage.put("period_pool", String(amount))
    }
    _getIOSTPool() {
        return Number(storage.get("iost_pool"))
    }
    _setIOSTPool(amount) {
        storage.put("iost_pool", String(amount))
    }
    _getBOSTPool() {
        return Number(storage.get("iost_pool"))
    }
    _requireAuth(account, permission) {
        const ret = blockchain.requireAuth(account, permission);
        if (ret !== true) {
            throw new Error('require auth failed. ret = ' + ret);
        }
    }

    _getBOSTExchangeRate(period) {
        let n = Number(period)
        let bost = 0.3955829279 * (4593996.386 - n * n - (n / 3) * (n / 3) - (n / 5) * (n / 5) - (n / 8) * (n / 8) - (n / 11) * (n / 11) - (250000 - (n - 599) * (n - 599)) * 1.312186314)
        return bost / IOST_PER_PERIOD
    }


}

module.exports = Bost;
