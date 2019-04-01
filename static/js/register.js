let form = document.querySelector('.form')
console.log(form)

form.onsubmit = async function (e) {
  let reg = /[\<^\>^\\^\/^\(^\[]/g
  e.preventDefault()
  let username = document.querySelector('input[name="username"]').value
  let password = document.querySelector('input[name="password"]')
  let passwordto = document.querySelector('input[name="confirm"]')
  let captcha = document.querySelector('input[name="captcha"]')
  console.log(username)
  if (username.match(reg) || password.value.match(reg)) {
    alert('用户名或密码不可包含非法字符:<,>,\\,/,[,(,')
    return
  }
  if (password.value !== passwordto.value) {
    alert('密码不一致')
    password.value = ''
    passwordto.value = ''
    return
  }
  try {
    let res = await axios.post('/register', {
      username,
      password: password.value,
      captcha: captcha.value
    })
    console.log(res)
    if (res.data.msg && res.data.code === 0) {
      alert(res.data.msg)
      captcha.value = ''
      return
    }
    if (!res.data.msg && res.data.code === 200) {
      location.href = '/login'
    }
  } catch (e) {
    console.log(e)
  }
}