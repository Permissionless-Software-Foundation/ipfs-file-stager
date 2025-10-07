/*
  This Controller library is concerned with timer-based functions that are
  kicked off periodically.
*/

import config from '../../config/index.js'

class TimerControllers {
  constructor (localConfig = {}) {
    // Dependency Injection.
    this.adapters = localConfig.adapters
    if (!this.adapters) {
      throw new Error(
        'Instance of Adapters library required when instantiating Timer Controller libraries.'
      )
    }
    this.useCases = localConfig.useCases
    if (!this.useCases) {
      throw new Error(
        'Instance of Use Cases library required when instantiating Timer Controller libraries.'
      )
    }

    this.debugLevel = localConfig.debugLevel

    // Constants
    this.cleanUsageInterval = 60000 * 60 // 1 hour
    this.backupUsageInterval = 60000 * 10 // 10 minutes
    this.updateWritePriceInterval = 60000 * 60 // 1 hour

    // Encapsulate dependencies
    this.config = config

    // Bind 'this' object to all subfunctions.
    this.cleanUsage = this.cleanUsage.bind(this)
    this.clearStagedFiles = this.clearStagedFiles.bind(this)
    this.backupUsage = this.backupUsage.bind(this)
    this.updateWritePrice = this.updateWritePrice.bind(this)
  }

  // Start all the time-based controllers.
  startTimers () {
    // Any new timer control functions can be added here. They will be started
    // when the server starts.
    this.clearStagedFilesHandle = setInterval(this.clearStagedFiles, 60000 * 63) // 1 hour
    this.cleanUsageHandle = setInterval(this.cleanUsage, this.cleanUsageInterval)
    this.backupUsageHandle = setInterval(this.backupUsage, this.backupUsageInterval)
    this.updateWritePriceHandle = setInterval(this.updateWritePrice, this.updateWritePriceInterval)

    return true
  }

  stopTimers () {
    clearInterval(this.cleanUsageHandle)
    clearInterval(this.backupUsageHandle)
    clearInterval(this.updateWritePriceHandle)
  }

  // Clean the usage state so that stats reflect the last 24 hours.
  cleanUsage () {
    try {
      clearInterval(this.cleanUsageHandle)

      const now = new Date()
      console.log(`cleanUsage() Timer Controller executing at ${now.toLocaleString()}`)

      this.useCases.usage.cleanUsage()

      this.cleanUsageHandle = setInterval(this.cleanUsage, this.cleanUsageInterval)

      return true
    } catch (err) {
      console.error('Error in time-controller.js/cleanUsage(): ', err)

      this.cleanUsageHandle = setInterval(this.cleanUsage, this.cleanUsageInterval)

      // Note: Do not throw an error. This is a top-level function.
      return false
    }
  }

  // Backup the usage stats to the database
  async backupUsage () {
    try {
      clearInterval(this.backupUsageHandle)

      console.log('backupUsage() Timer Controller executing at ', new Date().toLocaleString())

      // Clear the database of old usage data.
      await this.useCases.usage.clearUsage()

      // Save the current usage snapshot to the database.
      await this.useCases.usage.saveUsage()

      this.backupUsageHandle = setInterval(this.backupUsage, this.backupUsageInterval)

      return true
    } catch (err) {
      console.error('Error in time-controller.js/backupUsage(): ', err)

      this.backupUsageHandle = setInterval(this.backupUsage, this.backupUsageInterval)

      // Note: Do not throw an error. This is a top-level function.
      return false
    }
  }

  clearStagedFiles () {
    try {
      this.useCases.ipfs.clearStagedFiles()
      return true
    } catch (err) {
      console.error('Error in time-controller.js/clearStagedFiles(): ', err)

      // Note: Do not throw an error. This is a top-level function.
      return false
    }
  }

  // Update the PSF write price to keep the cache fresh. This way users do not get delayed API calls.
  async updateWritePrice () {
    try {
      const wallet = this.adapters.wallet.bchWallet

      // Get the cost in PSF tokens to write 1MB to the network.
      const writePrice = await wallet.getPsfWritePrice()
      console.log('Write Price cache updated. writePrice: ', writePrice)
    } catch (err) {
      console.error('Error in time-controller.js/updateWritePrice(): ', err)

      // Note: Do not throw an error. This is a top-level function.
      return false
    }
  }
}

export default TimerControllers
