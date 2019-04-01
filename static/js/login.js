let form = document.querySelector('.form')
// 不可输入< > / \
form.onsubmit = async function (e) {
  e.preventDefault()
  let username = document.querySelector('input[name="username"]').value
  let password = document.querySelector('input[name="password"]').value
  let captcha = document.querySelector('input[name="captcha"]').value
  try {
    let res = await axios.post('/login', {
      username,
      password,
      captcha
    })
    if (res.data.msg && res.data.code === 0) {
      alert(res.data.msg)
      return
    } 
    if (!res.data.msg && res.data.code === 200){
      location.href = '/'
      return
    }
  } catch (e) {
    console.log(e)
  }
}






