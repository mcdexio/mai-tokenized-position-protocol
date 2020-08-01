// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./TokenizerStorage.sol";

/**
 * @dev Implemetation of ERC20 interfaces.
 *
 * This file came from "openzeppelin/contracts/token/ERC20/ERC20.sol", except:
 * 1. All storage are moved into the parent
 * 2. Decimals is always 18
 * 3. Omit Context. Omit constructor
 */
contract ERC20 is TokenizerStorage, IERC20 {
    using SafeMath for uint256;

    // Using fixed decimals 18
    uint8 constant private ERC20_DECIMALS = 18;

    // Exact the same as openzeppelin
    function name() public view returns (string memory) {
        return _name;
    }

    // Exact the same as openzeppelin
    function symbol() public view returns (string memory) {
        return _symbol;
    }

    function decimals() public virtual pure returns (uint8) {
        return ERC20_DECIMALS;
    }

    // Exact the same as openzeppelin
    function totalSupply() public view override returns (uint256) {
        return _totalSupply;
    }

    // Exact the same as openzeppelin
    function balanceOf(address account) public view override returns (uint256) {
        return _balances[account];
    }

    function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    // Exact the same as openzeppelin
    function allowance(address owner, address spender) public view virtual override returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) public virtual override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) public virtual override returns (bool) {
        _transfer(sender, recipient, amount);
        _approve(sender, msg.sender, _allowances[sender][msg.sender].sub(amount, "ERC20: transfer amount exceeds allowance"));
        return true;
    }

    function increaseAllowance(address spender, uint256 addedValue) public virtual returns (bool) {
        _approve(msg.sender, spender, _allowances[msg.sender][spender].add(addedValue));
        return true;
    }

    // Exact the same as openzeppelin
    function decreaseAllowance(address spender, uint256 subtractedValue) public virtual returns (bool) {
        _approve(msg.sender, spender, _allowances[msg.sender][spender].sub(subtractedValue, "ERC20: decreased allowance below zero"));
        return true;
    }

    // Exact the same as openzeppelin
    function _transfer(address sender, address recipient, uint256 amount) internal virtual {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");

        _beforeTokenTransfer(sender, recipient, amount);

        _balances[sender] = _balances[sender].sub(amount, "ERC20: transfer amount exceeds balance");
        _balances[recipient] = _balances[recipient].add(amount);
        emit Transfer(sender, recipient, amount);
    }

    // Exact the same as openzeppelin
    function _mint(address account, uint256 amount) internal virtual {
        require(account != address(0), "ERC20: mint to the zero address");

        _beforeTokenTransfer(address(0), account, amount);

        _totalSupply = _totalSupply.add(amount);
        _balances[account] = _balances[account].add(amount);
        emit Transfer(address(0), account, amount);
    }

    // Exact the same as openzeppelin
    function _burn(address account, uint256 amount) internal virtual {
        require(account != address(0), "ERC20: burn from the zero address");

        _beforeTokenTransfer(account, address(0), amount);

        _balances[account] = _balances[account].sub(amount, "ERC20: burn amount exceeds balance");
        _totalSupply = _totalSupply.sub(amount);
        emit Transfer(account, address(0), amount);
    }

    // Exact the same as openzeppelin
    function _approve(address owner, address spender, uint256 amount) internal virtual {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    // Exact the same as openzeppelin
    function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual { }
}