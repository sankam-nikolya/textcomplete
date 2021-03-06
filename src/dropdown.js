// @flow
import EventEmitter from "eventemitter3"

import DropdownItem from "./dropdown_item"
import SearchResult from "./search_result"
import { createCustomEvent } from "./utils"
import type { CursorOffset } from "./editor"

const DEFAULT_CLASS_NAME = "dropdown-menu textcomplete-dropdown"

/** @typedef */
export type DropdownOptions = {
  className?: string,
  footer?: any => string | string,
  header?: any => string | string,
  maxCount?: number,
  placement?: string,
  rotate?: boolean,
  style?: { [string]: string },
}

/**
 * Encapsulate a dropdown view.
 *
 * @prop {boolean} shown - Whether the #el is shown or not.
 * @prop {DropdownItem[]} items - The array of rendered dropdown items.
 */
export default class Dropdown extends EventEmitter {
  shown: boolean
  items: DropdownItem[]
  footer: $PropertyType<DropdownOptions, "footer">
  header: $PropertyType<DropdownOptions, "header">
  maxCount: $PropertyType<DropdownOptions, "maxCount">
  rotate: $PropertyType<DropdownOptions, "rotate">
  placement: $PropertyType<DropdownOptions, "placement">
  _el: ?HTMLUListElement

  static createElement(): HTMLUListElement {
    const el = document.createElement("ul")
    const style = el.style
    style.display = "none"
    style.position = "absolute"
    style.zIndex = "10000"
    const body = document.body
    if (body) {
      body.appendChild(el)
    }
    return el
  }

  constructor(options: DropdownOptions) {
    super()
    this.shown = false
    this.items = []
    this.footer = options.footer
    this.header = options.header
    this.maxCount = options.maxCount || 10
    this.el.className = options.className || DEFAULT_CLASS_NAME
    this.rotate = options.hasOwnProperty("rotate") ? options.rotate : true
    this.placement = options.placement
    const style = options.style
    if (style) {
      Object.keys(style).forEach(key => {
        ;(this.el.style: any)[key] = style[key]
      })
    }
  }

  /**
   * @return {this}
   */
  destroy() {
    const parentNode = this.el.parentNode
    if (parentNode) {
      parentNode.removeChild(this.el)
    }
    this.clear()._el = null
    return this
  }

  get el(): HTMLUListElement {
    if (!this._el) {
      this._el = Dropdown.createElement()
    }
    return this._el
  }

  /**
   * Render the given data as dropdown items.
   *
   * @return {this}
   */
  render(searchResults: SearchResult[], cursorOffset: CursorOffset) {
    const renderEvent = createCustomEvent("render", { cancelable: true })
    this.emit("render", renderEvent)
    if (renderEvent.defaultPrevented) {
      return this
    }
    const rawResults = searchResults.map(searchResult => searchResult.data)
    const dropdownItems = searchResults
      .slice(0, this.maxCount || searchResults.length)
      .map(searchResult => new DropdownItem(searchResult))
    this.clear()
      .setStrategyId(searchResults[0])
      .renderEdge(rawResults, "header")
      .append(dropdownItems)
      .renderEdge(rawResults, "footer")
      .setOffset(cursorOffset)
      .show()
    this.emit("rendered", createCustomEvent("rendered"))
    return this
  }

  /**
   * Hide the dropdown then sweep out items.
   *
   * @return {this}
   */
  deactivate() {
    return this.hide().clear()
  }

  /**
   * @return {this}
   */
  select(dropdownItem: DropdownItem) {
    const detail = { searchResult: dropdownItem.searchResult }
    const selectEvent = createCustomEvent("select", {
      cancelable: true,
      detail: detail,
    })
    this.emit("select", selectEvent)
    if (selectEvent.defaultPrevented) {
      return this
    }
    this.deactivate()
    this.emit("selected", createCustomEvent("selected", { detail }))
    return this
  }

  /**
   * @return {this}
   */
  up(e: CustomEvent) {
    return this.shown ? this.moveActiveItem("prev", e) : this
  }

  /**
   * @return {this}
   */
  down(e: CustomEvent) {
    return this.shown ? this.moveActiveItem("next", e) : this
  }

  /**
   * Retrieve the active item.
   */
  getActiveItem(): ?DropdownItem {
    return this.items.find(item => item.active)
  }

  /**
   * Add items to dropdown.
   *
   * @private
   */
  append(items: DropdownItem[]) {
    const fragment = document.createDocumentFragment()
    items.forEach(item => {
      this.items.push(item)
      item.appended(this)
      fragment.appendChild(item.el)
    })
    this.el.appendChild(fragment)
    return this
  }

  /** @private */
  setOffset(cursorOffset: CursorOffset) {
    if (cursorOffset.left) {
      this.el.style.left = `${cursorOffset.left}px`
    } else if (cursorOffset.right) {
      this.el.style.right = `${cursorOffset.right}px`
    }
    if (this.isPlacementTop()) {
      const element = document.documentElement
      if (element) {
        this.el.style.bottom = `${element.clientHeight -
          cursorOffset.top +
          cursorOffset.lineHeight}px`
      }
    } else {
      this.el.style.top = `${cursorOffset.top}px`
    }
    return this
  }

  /**
   * Show the element.
   *
   * @private
   */
  show() {
    if (!this.shown) {
      const showEvent = createCustomEvent("show", { cancelable: true })
      this.emit("show", showEvent)
      if (showEvent.defaultPrevented) {
        return this
      }
      this.el.style.display = "block"
      this.shown = true
      this.emit("shown", createCustomEvent("shown"))
    }
    return this
  }

  /**
   * Hide the element.
   *
   * @private
   */
  hide() {
    if (this.shown) {
      const hideEvent = createCustomEvent("hide", { cancelable: true })
      this.emit("hide", hideEvent)
      if (hideEvent.defaultPrevented) {
        return this
      }
      this.el.style.display = "none"
      this.shown = false
      this.emit("hidden", createCustomEvent("hidden"))
    }
    return this
  }

  /**
   * Clear search results.
   *
   * @private
   */
  clear() {
    this.el.innerHTML = ""
    this.items.forEach(item => item.destroy())
    this.items = []
    return this
  }

  /** @private */
  moveActiveItem(name: "next" | "prev", e: CustomEvent) {
    const activeItem: any = this.getActiveItem()
    let nextActiveItem
    if (activeItem) {
      nextActiveItem = activeItem[name]
    } else {
      nextActiveItem =
        name === "next" ? this.items[0] : this.items[this.items.length - 1]
    }
    if (nextActiveItem) {
      nextActiveItem.activate()
      e.preventDefault()
    }
    return this
  }

  /** @private */
  setStrategyId(searchResult: ?SearchResult) {
    const strategyId = searchResult && searchResult.strategy.props.id
    if (strategyId) {
      this.el.setAttribute("data-strategy", strategyId)
    } else {
      this.el.removeAttribute("data-strategy")
    }
    return this
  }

  /**
   * @private
   * @param {object[]} rawResults - What callbacked by search function.
   */
  renderEdge(rawResults: Object[], type: "header" | "footer") {
    const source = (type === "header" ? this.header : this.footer) || ""
    const content: any =
      typeof source === "function" ? source(rawResults) : source
    const li = document.createElement("li")
    li.classList.add(`textcomplete-${type}`)
    li.innerHTML = content
    this.el.appendChild(li)
    return this
  }

  /** @private */
  isPlacementTop() {
    return this.placement === "top"
  }
}
